/**
 * Aceite do Bloco 2 contra PostgreSQL real.
 *
 * Rode com:
 *   TEST_FILE=block2-integrity.test.ts pnpm --filter @workspace/api-server test
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  locationsTable,
  charactersTable,
  characterCastTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  rotationDailyAdvancesTable,
  sessionsTable,
  formationsTable,
  occurrencesTable,
  historyEventsTable,
  agendaEventsTable,
  dailyBooksTable,
  dailyBookScenesTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookAssignmentsTable,
} from "@workspace/db";
import { advanceRotationCountsFromWinners } from "../src/services/line-resolver.js";
import { findFormationsByPeopleCount } from "../src/services/formation-library.js";
import {
  createOccurrence,
  transitionOccurrence,
  OccurrenceReasonRequiredError,
} from "../src/services/occurrence-lifecycle.js";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: string; cause?: { code?: string } };
  return value.code ?? value.cause?.code;
}

async function run() {
  const tag = `block2_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({
    organizationId: org!.id,
    name: `${tag}_operation`,
    locations: ["Snowland"],
    status: "ACTIVE",
  }).returning();
  const [person] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: `${tag}_person`,
  }).returning();

  let locationId: string | null = null;
  let characterId: string | null = null;
  let showBookId: string | null = null;
  let sceneId: string | null = null;
  let blockId: string | null = null;
  const roleIds: string[] = [];
  const lineIds: string[] = [];
  const formationIds: string[] = [];
  const occurrenceIds: string[] = [];
  let agendaEventId: string | null = null;
  let dailyBookId: string | null = null;
  let dailySceneId: string | null = null;
  let dailyBlockId: string | null = null;
  const dailyPositionIds: string[] = [];

  try {
    const [location] = await db.insert(locationsTable).values({
      organizationId: org!.id,
      name: "Snowland",
    }).returning();
    locationId = location!.id;

    const [character] = await db.insert(charactersTable).values({
      name: "Astrid",
      locationId: location!.id,
      mode: "rodizio",
    }).returning();
    characterId = character!.id;
    await db.insert(characterCastTable).values({
      characterId: character!.id,
      personId: person!.id,
      order: 0,
      timesDone: 0,
    });

    const [showBook] = await db.insert(showBooksTable).values({
      operationId: operation!.id,
      title: `${tag}_show`,
      createdBy: person!.id,
    }).returning();
    showBookId = showBook!.id;

    const [scene] = await db.insert(showBookScenesTable).values({
      showBookId: showBook!.id,
      name: `${tag}_scene`,
      order: 0,
    }).returning();
    sceneId = scene!.id;
    const [block] = await db.insert(showBookBlocksTable).values({
      showBookId: showBook!.id,
      sceneId: scene!.id,
      name: `${tag}_block`,
      order: 0,
    }).returning();
    blockId = block!.id;

    async function createRotationLine(label: string) {
      const [role] = await db.insert(showBookRolesTable).values({
        showBookId: showBook!.id,
        blockId: block!.id,
        name: `${tag}_${label}_position`,
        order: roleIds.length,
      }).returning();
      roleIds.push(role!.id);
      const [line] = await db.insert(showBookLinesTable).values({
        positionId: role!.id,
        characterId: character!.id,
        type: "ROTATION" as any,
        config: { characterId: character!.id, memberIds: [person!.id] } as any,
        order: 0,
      }).returning();
      lineIds.push(line!.id);
      return line!.id;
    }

    const lineA = await createRotationLine("a");
    const lineB = await createRotationLine("b");

    const [morning] = await db.insert(sessionsTable).values({
      showId: showBook!.id,
      startTime: "10:00",
      endTime: "11:00",
      callTime: "09:30",
    }).returning();
    const [afternoon] = await db.insert(sessionsTable).values({
      showId: showBook!.id,
      startTime: "16:00",
      endTime: "17:00",
      callTime: "15:30",
    }).returning();
    assert(morning?.startTime === "10:00:00" && morning?.endTime === "11:00:00", "Sessao matinal preserva início e fim");
    assert(afternoon?.startTime === "16:00:00" && afternoon?.endTime === "17:00:00", "duas sessões do mesmo show coexistem no mesmo dia lógico");

    let invalidSessionRejected = false;
    try {
      await db.insert(sessionsTable).values({
        showId: showBook!.id,
        startTime: "18:00",
        endTime: "18:00",
      });
    } catch (error) {
      invalidSessionRejected = errorCode(error) === "23514";
    }
    assert(invalidSessionRejected, "Sessao com fim igual ao início é rejeitada pelo banco");

    const date = "2026-09-16";
    const firstAdvance = await advanceRotationCountsFromWinners({
      [lineA]: person!.id,
      [lineB]: person!.id,
    }, date);
    const repeatedAdvance = await advanceRotationCountsFromWinners({
      [lineB]: person!.id,
      [lineA]: person!.id,
    }, date);
    assert(firstAdvance === 1 && repeatedAdvance === 0, "ledger novo mantém um avanço por personagem/pessoa/data");
    const ledger = await db.select().from(rotationDailyAdvancesTable).where(and(
      eq(rotationDailyAdvancesTable.characterId, character!.id),
      eq(rotationDailyAdvancesTable.userId, person!.id),
      eq(rotationDailyAdvancesTable.date, date),
    ));
    assert(ledger.length === 1 && ledger[0]?.characterId === character!.id, "ledger referencia personagem por UUID após a migração");

    const [formationSevenA] = await db.insert(formationsTable).values({
      name: `${tag}_formation_seven_a`,
      peopleCount: 7,
      positions: [{ name: "centro" }],
      showId: showBook!.id,
    }).returning();
    const [formationSevenB] = await db.insert(formationsTable).values({
      name: `${tag}_formation_seven_b`,
      peopleCount: 7,
      positions: [{ name: "linha" }],
    }).returning();
    const [formationFive] = await db.insert(formationsTable).values({
      name: `${tag}_formation_five`,
      peopleCount: 5,
      positions: [],
    }).returning();
    formationIds.push(formationSevenA!.id, formationSevenB!.id, formationFive!.id);
    const seven = await findFormationsByPeopleCount(7);
    assert(
      seven.some((formation) => formation.id === formationSevenA!.id)
        && seven.some((formation) => formation.id === formationSevenB!.id)
        && seven.every((formation) => formation.peopleCount === 7),
      "busca de Formacao por quantidade retorna as formações daquele número",
    );

    const occurrence = await createOccurrence({
      personId: person!.id,
      date,
      type: "ausencia",
      description: "Registro de teste do ciclo de vida",
      registeredBy: person!.id,
      reason: "Registro inicial",
    });
    occurrenceIds.push(occurrence.id);
    assert(occurrence.state === "aberta", "ocorrência nasce aberta sem check-in associado");
    const underAnalysis = await transitionOccurrence({
      occurrenceId: occurrence.id,
      to: "em_analise",
      registeredBy: person!.id,
      reason: "Supervisão iniciou a análise",
    });
    const resolved = await transitionOccurrence({
      occurrenceId: occurrence.id,
      to: "resolvida",
      registeredBy: person!.id,
      reason: "Tratativa concluída",
    });
    assert(underAnalysis.state === "em_analise" && resolved.state === "resolvida", "ocorrência percorre aberta → em_analise → resolvida");
    let blankTransitionRejected = false;
    try {
      await transitionOccurrence({
        occurrenceId: occurrence.id,
        to: "aberta",
        registeredBy: person!.id,
        reason: "   ",
      });
    } catch (error) {
      blankTransitionRejected = error instanceof OccurrenceReasonRequiredError;
    }
    assert(blankTransitionRejected, "cada transição de ocorrência exige motivo não vazio");
    const occurrenceHistory = await db.select().from(historyEventsTable)
      .where(eq(historyEventsTable.entityId, occurrence.id));
    assert(
      occurrenceHistory.length === 3
        && occurrenceHistory.every((event) => Boolean((event.metadata as any)?.reason))
        && occurrenceHistory.every((event) => event.afterState !== null),
      "cada escrita da ocorrência grava Registro com motivo e estado antes/depois",
    );

    const [agendaEvent] = await db.insert(agendaEventsTable).values({
      operationId: operation!.id,
      showBookId: showBook!.id,
      type: "SHOW",
      title: `${tag}_agenda`,
      date,
      createdBy: person!.id,
    }).returning();
    agendaEventId = agendaEvent!.id;
    const [dailyBook] = await db.insert(dailyBooksTable).values({
      agendaEventId: agendaEvent!.id,
      showBookId: showBook!.id,
      status: "DRAFT",
      version: 1,
      snapshotJson: {},
    }).returning();
    dailyBookId = dailyBook!.id;
    const [dailyScene] = await db.insert(dailyBookScenesTable).values({
      dailyBookId: dailyBook!.id,
      name: `${tag}_daily_scene`,
      order: 0,
      sourceSceneId: scene!.id,
    }).returning();
    dailySceneId = dailyScene!.id;
    const [dailyBlock] = await db.insert(dailyBookBlocksTable).values({
      dailyBookId: dailyBook!.id,
      sceneId: dailyScene!.id,
      name: `${tag}_daily_block`,
      order: 0,
      sourceBlockId: block!.id,
    }).returning();
    dailyBlockId = dailyBlock!.id;
    const [positionA] = await db.insert(dailyBookPositionsTable).values({
      dailyBookId: dailyBook!.id,
      blockId: dailyBlock!.id,
      name: `${tag}_daily_position_a`,
      sourceRoleId: roleIds[0],
    }).returning();
    const [positionB] = await db.insert(dailyBookPositionsTable).values({
      dailyBookId: dailyBook!.id,
      blockId: dailyBlock!.id,
      name: `${tag}_daily_position_b`,
      sourceRoleId: roleIds[1],
    }).returning();
    dailyPositionIds.push(positionA!.id, positionB!.id);
    await db.insert(dailyBookAssignmentsTable).values({
      dailyBookId: dailyBook!.id,
      positionId: positionA!.id,
      sceneId: dailyScene!.id,
      userId: person!.id,
      status: "ASSIGNED",
    });
    let duplicateSceneRejected = false;
    try {
      await db.insert(dailyBookAssignmentsTable).values({
        dailyBookId: dailyBook!.id,
        positionId: positionB!.id,
        sceneId: dailyScene!.id,
        userId: person!.id,
        status: "ASSIGNED",
      });
    } catch (error) {
      duplicateSceneRejected = errorCode(error) === "23505";
    }
    assert(duplicateSceneRejected, "constraint rejeita a mesma pessoa em duas posições da mesma cena");
  } finally {
    if (dailyBookId) await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, dailyBookId));
    if (dailyPositionIds.length > 0) await db.delete(dailyBookPositionsTable).where(inArray(dailyBookPositionsTable.id, dailyPositionIds));
    if (dailyBlockId) await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.id, dailyBlockId));
    if (dailySceneId) await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.id, dailySceneId));
    if (dailyBookId) await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, dailyBookId));
    if (agendaEventId) await db.delete(agendaEventsTable).where(eq(agendaEventsTable.id, agendaEventId));
    if (occurrenceIds.length > 0) {
      await db.delete(historyEventsTable).where(inArray(historyEventsTable.entityId, occurrenceIds));
      await db.delete(occurrencesTable).where(inArray(occurrencesTable.id, occurrenceIds));
    }
    if (formationIds.length > 0) await db.delete(formationsTable).where(inArray(formationsTable.id, formationIds));
    if (lineIds.length > 0) {
      await db.delete(rotationDailyAdvancesTable).where(inArray(rotationDailyAdvancesTable.sourceLineId, lineIds));
      await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.id, lineIds));
    }
    if (roleIds.length > 0) await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.id, roleIds));
    if (blockId) await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.id, blockId));
    if (sceneId) await db.delete(showBookScenesTable).where(eq(showBookScenesTable.id, sceneId));
    if (showBookId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.showId, showBookId));
      await db.delete(showBooksTable).where(eq(showBooksTable.id, showBookId));
    }
    if (characterId) {
      await db.delete(characterCastTable).where(eq(characterCastTable.characterId, characterId));
      await db.delete(charactersTable).where(eq(charactersTable.id, characterId));
    }
    if (locationId) await db.delete(locationsTable).where(eq(locationsTable.id, locationId));
    await db.delete(usersTable).where(eq(usersTable.id, person!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

run()
  .then(async () => {
    console.log(`block2-integrity: ${passed} asserts passed`);
    if (failures.length > 0) process.exitCode = 1;
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
