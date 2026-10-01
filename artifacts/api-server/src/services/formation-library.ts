import { and, asc, desc, eq, inArray, isNull, max, or, sql } from "drizzle-orm";
import {
  db,
  formationsTable,
  historyEventsTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
  operationsTable,
  type Formation,
} from "@workspace/db";

export interface FormationPosition {
  role: string;
  function: string;
  coordinate: unknown;
  [key: string]: unknown;
}

export class FormationNameRequiredError extends Error {
  constructor() {
    super("Nome obrigatório para salvar a Formação.");
    this.name = "FormationNameRequiredError";
  }
}

export class FormationPositionsInvalidError extends Error {
  constructor() {
    super("As posições da Formação devem conter papel/função e coordenada.");
    this.name = "FormationPositionsInvalidError";
  }
}

export class FormationNotFoundError extends Error {
  constructor() {
    super("Formação não encontrada.");
    this.name = "FormationNotFoundError";
  }
}

export class FormationTargetNotFoundError extends Error {
  constructor() {
    super("Cena ou bloco de destino não encontrado.");
    this.name = "FormationTargetNotFoundError";
  }
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePosition(value: unknown): FormationPosition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const role = textValue(raw.role) ?? textValue(raw.papel) ?? textValue(raw.name) ?? textValue(raw.nome) ?? textValue(raw.function) ?? textValue(raw.funcao);
  const fn = textValue(raw.function) ?? textValue(raw.funcao) ?? role;
  const coordinate = raw.coordinate ?? raw.coordenada ?? raw.position ?? raw.posicao;
  if (!role || !fn || coordinate === undefined || coordinate === null) return null;
  return { ...raw, role, function: fn, coordinate };
}

function normalizePositions(value: unknown): FormationPosition[] {
  if (!Array.isArray(value)) throw new FormationPositionsInvalidError();
  const positions = value.map(normalizePosition);
  if (positions.some((position) => !position)) throw new FormationPositionsInvalidError();
  return positions as FormationPosition[];
}

function formationSnapshot(formation: Formation) {
  return {
    id: formation.id,
    name: formation.name,
    peopleCount: formation.peopleCount,
    positions: formation.positions,
    showId: formation.showId,
    sceneId: formation.sceneId,
    organizationId: formation.organizationId,
    active: formation.active,
    timesUsed: formation.timesUsed,
    lastUsedAt: formation.lastUsedAt,
  };
}

async function writeFormationHistory(
  tx: typeof db,
  formation: Formation,
  action: string,
  actorId: string,
  beforeState: Record<string, unknown> | null,
) {
  await tx.insert(historyEventsTable).values({
    orgId: null,
    category: "OPERATIONAL_CHANGE",
    title: action === "applied" ? "Formação aplicada ao show" : action === "created" ? "Formação salva da cena" : "Formação atualizada",
    narrative: action === "applied"
      ? `A Formação ${formation.name} foi copiada para uma cena.`
      : action === "created"
        ? `A Formação ${formation.name} foi criada a partir de uma cena.`
        : `A Formação ${formation.name} foi alterada.`,
    entityType: "formation",
    entityId: formation.id,
    actorId,
    actorType: "HUMAN",
    action: `formation.${action}`,
    beforeState,
    afterState: formationSnapshot(formation),
  });
}

/**
 * Busca formações pela quantidade de pessoas. A função só consulta a biblioteca:
 * ela não escolhe, copia ou preenche uma lacuna automaticamente.
 *
 * `showId` opcional restringe à biblioteca de um show (a aba "Formações" do Livro do Dia
 * navega show → quantidade; a Formação não guarda `sceneId`, só `showId`, então não há
 * agrupamento por cena — só por show).
 */
export async function findFormationsByPeopleCount(peopleCount: number, organizationId?: string, showId?: string) {
  if (!Number.isInteger(peopleCount) || peopleCount <= 0) return [];
  const scope = organizationId
    ? or(eq(formationsTable.organizationId, organizationId), isNull(formationsTable.organizationId))
    : undefined;
  const showScope = showId ? eq(formationsTable.showId, showId) : undefined;
  const exact = await db
    .select()
    .from(formationsTable)
    .where(and(eq(formationsTable.peopleCount, peopleCount), eq(formationsTable.active, true), scope, showScope))
    .orderBy(desc(formationsTable.timesUsed), asc(formationsTable.name), asc(formationsTable.id));
  if (exact.length > 0) return exact.map((formation) => ({ ...formation, approximate: false }));

  const adjacentCounts = [peopleCount - 1, peopleCount + 1].filter((count) => count > 0);
  if (adjacentCounts.length === 0) return [];
  const adjacent = await db
    .select()
    .from(formationsTable)
    .where(and(eq(formationsTable.active, true), inArray(formationsTable.peopleCount, adjacentCounts), scope, showScope))
    .orderBy(desc(formationsTable.timesUsed), asc(formationsTable.peopleCount), asc(formationsTable.name), asc(formationsTable.id));
  return adjacent.map((formation) => ({ ...formation, approximate: true }));
}

/** Lista toda a biblioteca ativa de um show, com o nome da cena (quando houver) — usada pela
 * aba "Formações" do Livro do Dia para navegar show → cena → quantidade, como no `.dc.html`. */
export async function listFormationsForShow(showId: string, organizationId?: string) {
  const scope = organizationId
    ? or(eq(formationsTable.organizationId, organizationId), isNull(formationsTable.organizationId))
    : undefined;
  const rows = await db
    .select({ formation: formationsTable, sceneName: showBookScenesTable.name })
    .from(formationsTable)
    .leftJoin(showBookScenesTable, eq(formationsTable.sceneId, showBookScenesTable.id))
    .where(and(eq(formationsTable.showId, showId), eq(formationsTable.active, true), scope))
    .orderBy(desc(formationsTable.peopleCount), desc(formationsTable.timesUsed), asc(formationsTable.name));
  return rows.map((row) => ({ ...row.formation, sceneName: row.sceneName ?? null }));
}

export async function applyFormationToScene(input: {
  formationId: string;
  showBookId: string;
  sceneId: string;
  blockId?: string | null;
  actorId: string;
  organizationId?: string;
}) {
  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const [formation] = await transactionDb.select().from(formationsTable).where(and(
      eq(formationsTable.id, input.formationId),
      eq(formationsTable.active, true),
      input.organizationId ? or(eq(formationsTable.organizationId, input.organizationId), isNull(formationsTable.organizationId)) : undefined,
    )).limit(1);
    if (!formation) throw new FormationNotFoundError();
    const positions = normalizePositions(formation.positions);

    const [scene] = await transactionDb
      .select({ scene: showBookScenesTable, operationId: showBooksTable.operationId, organizationId: operationsTable.organizationId })
      .from(showBookScenesTable)
      .innerJoin(showBooksTable, eq(showBookScenesTable.showBookId, showBooksTable.id))
      .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .where(and(
        eq(showBookScenesTable.id, input.sceneId),
        eq(showBookScenesTable.showBookId, input.showBookId),
      )).limit(1);
    if (!scene || (input.organizationId && scene.organizationId !== input.organizationId)) throw new FormationTargetNotFoundError();

    let blockId = input.blockId ?? null;
    let block: typeof showBookBlocksTable.$inferSelect | null = null;
    if (blockId) {
      const [loadedBlock] = await transactionDb.select().from(showBookBlocksTable).where(and(
        eq(showBookBlocksTable.id, blockId),
        eq(showBookBlocksTable.showBookId, input.showBookId),
        eq(showBookBlocksTable.sceneId, input.sceneId),
      )).limit(1);
      if (!loadedBlock) throw new FormationTargetNotFoundError();
      block = loadedBlock;
    } else {
      const [last] = await transactionDb
        .select({ order: max(showBookBlocksTable.order) })
        .from(showBookBlocksTable)
        .where(and(eq(showBookBlocksTable.showBookId, input.showBookId), eq(showBookBlocksTable.sceneId, input.sceneId)));
      const [createdBlock] = await transactionDb.insert(showBookBlocksTable).values({
        showBookId: input.showBookId,
        sceneId: input.sceneId,
        name: `Formação — ${formation.name}`,
        order: Number(last?.order ?? 0) + 1,
      }).returning();
      block = createdBlock ?? null;
      blockId = createdBlock?.id ?? null;
    }
    if (!block || !blockId) throw new FormationTargetNotFoundError();

    const createdRoles = positions.length > 0
      ? await transactionDb.insert(showBookRolesTable).values(positions.map((position, index) => ({
          showBookId: input.showBookId,
          blockId,
          name: position.role,
          order: index,
          tagsJson: [position.function],
          positionJson: position,
        }))).returning()
      : [];
    const [updatedFormation] = await transactionDb.update(formationsTable)
      .set({
        timesUsed: sql`${formationsTable.timesUsed} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(formationsTable.id, formation.id))
      .returning();
    if (!updatedFormation) throw new FormationNotFoundError();

    await transactionDb.insert(historyEventsTable).values({
      orgId: scene.organizationId,
      category: "OPERATIONAL_CHANGE",
      title: "Formação aplicada ao show",
      narrative: `A Formação ${formation.name} foi copiada para a cena ${scene.scene.name}.`,
      entityType: "formation",
      entityId: formation.id,
      actorId: input.actorId,
      actorType: "HUMAN",
      operationId: scene.operationId,
      action: "formation.applied",
      beforeState: { formation: formationSnapshot(formation), blockId, roles: [] },
      afterState: { formation: formationSnapshot(updatedFormation), blockId, roles: createdRoles },
    });
    return { formation: updatedFormation, scene: scene.scene, block, positions: createdRoles };
  });
}

export async function saveFormationFromScene(input: {
  sceneId: string;
  name: string;
  actorId: string;
  showId?: string | null;
  organizationId?: string;
}) {
  const name = textValue(input.name);
  if (!name) throw new FormationNameRequiredError();

  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const [scene] = await transactionDb
      .select({ scene: showBookScenesTable, show: showBooksTable, organizationId: operationsTable.organizationId })
      .from(showBookScenesTable)
      .innerJoin(showBooksTable, eq(showBookScenesTable.showBookId, showBooksTable.id))
      .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .where(eq(showBookScenesTable.id, input.sceneId)).limit(1);
    if (!scene) throw new FormationTargetNotFoundError();

    const blocks = await transactionDb.select().from(showBookBlocksTable)
      .where(and(eq(showBookBlocksTable.showBookId, scene.show.id), eq(showBookBlocksTable.sceneId, input.sceneId)))
      .orderBy(asc(showBookBlocksTable.order));
    const blockIds = blocks.map((block) => block.id);
    const roles = blockIds.length > 0
      ? await transactionDb.select().from(showBookRolesTable).where(inArray(showBookRolesTable.blockId, blockIds)).orderBy(asc(showBookRolesTable.order), asc(showBookRolesTable.id))
      : [];
    const positions = roles.map((role) => {
      const position = role.positionJson && Object.keys(role.positionJson).length > 0
        ? role.positionJson
        : { role: role.name, function: role.tagsJson?.[0] ?? role.name, coordinate: null };
      return position;
    });

    const [created] = await transactionDb.insert(formationsTable).values({
      name,
      peopleCount: positions.length,
      positions,
      showId: input.showId ?? scene.show.id,
      sceneId: input.sceneId,
      organizationId: scene.organizationId,
      active: true,
    }).returning();
    if (!created) throw new Error("Não foi possível salvar a Formação.");
    await transactionDb.insert(historyEventsTable).values({
      orgId: scene.organizationId,
      category: "OPERATIONAL_CHANGE",
      title: "Formação salva da cena",
      narrative: `A Formação ${name} foi salva a partir da cena ${scene.scene.name}.`,
      entityType: "formation",
      entityId: created.id,
      actorId: input.actorId,
      actorType: "HUMAN",
      operationId: scene.show.operationId,
      action: "formation.created",
      beforeState: null,
      afterState: formationSnapshot(created),
    });
    return created;
  });
}

export async function updateFormation(input: {
  formationId: string;
  actorId: string;
  name?: string;
  positions?: unknown;
  active?: boolean;
  organizationId?: string;
  onChanged?: (tx: typeof db, before: Formation, after: Formation) => Promise<void>;
}) {
  return db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const [current] = await transactionDb.select().from(formationsTable).where(and(
      eq(formationsTable.id, input.formationId),
      input.organizationId ? or(eq(formationsTable.organizationId, input.organizationId), isNull(formationsTable.organizationId)) : undefined,
    )).limit(1);
    if (!current) throw new FormationNotFoundError();
    const nextPositions: unknown[] = input.positions === undefined
      ? (Array.isArray(current.positions) ? current.positions : [])
      : normalizePositions(input.positions);
    const nextName = input.name === undefined ? current.name : textValue(input.name);
    if (!nextName) throw new FormationNameRequiredError();
    const [updated] = await transactionDb.update(formationsTable).set({
      name: nextName,
      positions: nextPositions,
      peopleCount: nextPositions.length,
      active: input.active ?? current.active,
      updatedAt: new Date(),
    }).where(eq(formationsTable.id, current.id)).returning();
    if (!updated) throw new FormationNotFoundError();
    await transactionDb.insert(historyEventsTable).values({
      orgId: updated.organizationId ?? null,
      category: "OPERATIONAL_CHANGE",
      title: "Formação atualizada",
      narrative: `A Formação ${updated.name} foi atualizada.`,
      entityType: "formation",
      entityId: updated.id,
      actorId: input.actorId,
      actorType: "HUMAN",
      action: "formation.updated",
      beforeState: formationSnapshot(current),
      afterState: formationSnapshot(updated),
    });
    await input.onChanged?.(transactionDb, current, updated);
    return updated;
  });
}

export async function deactivateFormation(formationId: string, actorId: string, organizationId?: string) {
  return updateFormation({ formationId, actorId, active: false, organizationId });
}
