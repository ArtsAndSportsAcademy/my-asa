/**
 * Aceite do Bloco 4 contra PostgreSQL real.
 * Cobre busca exata/adjacente, cópia independente entre biblioteca e cena,
 * auditoria, nome obrigatório e desativação sem apagar o uso histórico.
 */
import { and, eq, inArray } from "drizzle-orm";
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
  formationsTable,
  historyEventsTable,
} from "@workspace/db";
import {
  applyFormationToScene,
  deactivateFormation,
  findFormationsByPeopleCount,
  FormationNameRequiredError,
  saveFormationFromScene,
  updateFormation,
} from "../src/services/formation-library.js";

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

async function run() {
  const tag = `block4_${Date.now()}`;
  const [organization] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({
    organizationId: organization!.id,
    name: `${tag}_operation`,
    locations: ["Snowland"],
    status: "ACTIVE",
  }).returning();
  const [admin] = await db.insert(usersTable).values({
    organizationId: organization!.id,
    name: `${tag}_admin`,
    username: `${tag}_admin`,
  }).returning();
  const [showBook] = await db.insert(showBooksTable).values({
    operationId: operation!.id,
    title: `${tag}_show`,
    createdBy: admin!.id,
  }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({
    showBookId: showBook!.id,
    name: `${tag}_scene`,
    order: 0,
  }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({
    showBookId: showBook!.id,
    sceneId: scene!.id,
    name: `${tag}_block`,
    order: 0,
  }).returning();

  const formationIds: string[] = [];
  let appliedRoleIds: string[] = [];

  try {
    const positions = Array.from({ length: 7 }, (_, index) => ({
      role: `Bailarino ${index + 1}`,
      function: "Bailarino",
      coordinate: { x: index - 3, y: index % 2 },
    }));
    const [popularSeven] = await db.insert(formationsTable).values({
      name: `${tag}_seven_popular`,
      peopleCount: 7,
      positions,
      showId: showBook!.id,
      timesUsed: 8,
      active: true,
    }).returning();
    const [otherSeven] = await db.insert(formationsTable).values({
      name: `${tag}_seven_other`,
      peopleCount: 7,
      positions: positions.slice(0, 7),
      timesUsed: 2,
      active: true,
    }).returning();
    const [six] = await db.insert(formationsTable).values({
      name: `${tag}_six`,
      peopleCount: 6,
      positions: positions.slice(0, 6),
      timesUsed: 4,
      active: true,
    }).returning();
    const [four] = await db.insert(formationsTable).values({
      name: `${tag}_four`,
      peopleCount: 4,
      positions: positions.slice(0, 4),
      timesUsed: 1,
      active: true,
    }).returning();
    formationIds.push(popularSeven!.id, otherSeven!.id, six!.id, four!.id);

    const seven = await findFormationsByPeopleCount(7);
    assert(seven.length === 2 && seven.every((formation) => formation.peopleCount === 7 && formation.approximate === false), "busca por 7 devolve apenas formações de 7");
    assert(seven[0]?.id === popularSeven!.id && seven[0]!.timesUsed > seven[1]!.timesUsed, "formações exatas vêm ordenadas pelas mais usadas primeiro");

    const five = await findFormationsByPeopleCount(5);
    assert(five.length === 2 && five.every((formation) => formation.approximate === true), "busca sem resultado exato devolve formações adjacentes marcadas como aproximadas");
    assert(five.every((formation) => formation.peopleCount === 4 || formation.peopleCount === 6), "formações aproximadas são n−1 e n+1");

    const applied = await applyFormationToScene({
      formationId: popularSeven!.id,
      showBookId: showBook!.id,
      sceneId: scene!.id,
      blockId: block!.id,
      actorId: admin!.id,
      organizationId: organization!.id,
    });
    appliedRoleIds = applied.positions.map((role) => role.id);
    assert(applied.positions.length === 7 && applied.positions.every((role) => Boolean(role.positionJson.coordinate)), "aplicação copia as posições estruturadas para a cena");
    assert(applied.formation.timesUsed === 9 && applied.formation.lastUsedAt instanceof Date, "aplicar incrementa vezes_usada e grava ultima_vez_em");

    const [formationBeforeSceneEdit] = await db.select().from(formationsTable).where(eq(formationsTable.id, popularSeven!.id));
    await db.update(showBookRolesTable).set({
      name: "Bailarino editado na cena",
      positionJson: { role: "Bailarino editado na cena", function: "Bailarino", coordinate: { x: 99, y: 99 } },
    }).where(eq(showBookRolesTable.id, appliedRoleIds[0]!));
    const [formationAfterSceneEdit] = await db.select().from(formationsTable).where(eq(formationsTable.id, popularSeven!.id));
    assert(
      JSON.stringify(formationAfterSceneEdit?.positions) === JSON.stringify(formationBeforeSceneEdit?.positions),
      "editar a cena depois da aplicação não altera a Formação da biblioteca",
    );

    const changedLibraryPositions = positions.map((position, index) => index === 0
      ? { ...position, coordinate: { x: -99, y: -99 } }
      : position);
    await updateFormation({ formationId: popularSeven!.id, actorId: admin!.id, positions: changedLibraryPositions });
    const [roleAfterLibraryEdit] = await db.select().from(showBookRolesTable).where(eq(showBookRolesTable.id, appliedRoleIds[0]!));
    assert(
      (roleAfterLibraryEdit?.positionJson as { coordinate?: { x?: number } } | null)?.coordinate?.x === 99,
      "editar a Formação não altera a cena já aplicada",
    );

    let blankNameRejected = false;
    try {
      await saveFormationFromScene({ sceneId: scene!.id, name: "   ", actorId: admin!.id });
    } catch (error) {
      blankNameRejected = error instanceof FormationNameRequiredError;
    }
    assert(blankNameRejected, "salvar da cena para a biblioteca sem nome é rejeitado");

    const copied = await saveFormationFromScene({
      sceneId: scene!.id,
      name: `${tag}_copied_from_scene`,
      actorId: admin!.id,
      showId: showBook!.id,
    });
    formationIds.push(copied.id);
    assert(copied.peopleCount === 7 && Array.isArray(copied.positions), "salvar da cena cria uma Formação independente com as posições");

    const deactivated = await deactivateFormation(popularSeven!.id, admin!.id);
    const afterDeactivateSearch = await findFormationsByPeopleCount(7);
    const appliedRoles = await db.select().from(showBookRolesTable).where(inArray(showBookRolesTable.id, appliedRoleIds));
    assert(deactivated.active === false && !afterDeactivateSearch.some((formation) => formation.id === popularSeven!.id), "Formação desativada não aparece na busca");
    assert(appliedRoles.length === 7, "desativar a Formação não apaga nem corrompe os shows que já a usaram");

    const formationHistory = await db.select().from(historyEventsTable).where(and(
      eq(historyEventsTable.entityType, "formation"),
      inArray(historyEventsTable.entityId, formationIds),
    ));
    assert(formationHistory.length >= 4, "aplicação, cópia, atualização e desativação gravam Registro");
  } finally {
    if (formationIds.length > 0) await db.delete(historyEventsTable).where(inArray(historyEventsTable.entityId, formationIds));
    if (appliedRoleIds.length > 0) await db.delete(showBookRolesTable).where(inArray(showBookRolesTable.id, appliedRoleIds));
    if (block) await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.id, block.id));
    // Formações apagadas antes da cena: desde que formations ganhou scene_id (tela 14), uma
    // Formação salva de uma cena referencia essa cena — apagar a cena primeiro viola a FK.
    if (formationIds.length > 0) await db.delete(formationsTable).where(inArray(formationsTable.id, formationIds));
    if (scene) await db.delete(showBookScenesTable).where(eq(showBookScenesTable.id, scene.id));
    if (showBook) await db.delete(showBooksTable).where(eq(showBooksTable.id, showBook.id));
    if (admin) await db.delete(usersTable).where(eq(usersTable.id, admin.id));
    if (operation) await db.delete(operationsTable).where(eq(operationsTable.id, operation.id));
    if (organization) await db.delete(organizationsTable).where(eq(organizationsTable.id, organization.id));
  }

  if (failures.length > 0) throw new Error(`${failures.length} teste(s) do Bloco 4 falharam`);
  console.log(`block4-integrity: ${passed} asserts passed`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
