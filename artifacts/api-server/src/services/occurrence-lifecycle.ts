import { and, eq } from "drizzle-orm";
import {
  db,
  historyEventsTable,
  occurrencesTable,
  usersTable,
  type Occurrence,
} from "@workspace/db";
import { normalizeReason } from "../lib/reason.js";

export type OccurrenceState = "aberta" | "em_analise" | "resolvida";

const NEXT_STATE: Record<OccurrenceState, OccurrenceState | null> = {
  aberta: "em_analise",
  em_analise: "resolvida",
  resolvida: null,
};

export class OccurrenceReasonRequiredError extends Error {
  constructor() {
    super("Motivo obrigatório para registrar ou alterar uma ocorrência.");
    this.name = "OccurrenceReasonRequiredError";
  }
}

export class InvalidOccurrenceTransitionError extends Error {
  constructor(from: OccurrenceState, to: OccurrenceState) {
    super(`Transição de ocorrência inválida: ${from} -> ${to}.`);
    this.name = "InvalidOccurrenceTransitionError";
  }
}

function stateSnapshot(occurrence: Occurrence) {
  return {
    id: occurrence.id,
    personId: occurrence.personId,
    date: occurrence.date,
    type: occurrence.type,
    description: occurrence.description,
    state: occurrence.state,
    registeredBy: occurrence.registeredBy,
    reason: occurrence.reason,
  };
}

async function writeOccurrenceHistory(
  tx: typeof db,
  occurrence: Occurrence,
  beforeState: Record<string, unknown> | null,
  reason: string,
  action: string,
  actorId: string = occurrence.registeredBy,
) {
  const [person] = await tx
    .select({ organizationId: usersTable.organizationId })
    .from(usersTable)
    .where(eq(usersTable.id, occurrence.personId))
    .limit(1);
  await tx.insert(historyEventsTable).values({
    orgId: person?.organizationId ?? null,
    category: "OPERATIONAL_CHANGE",
    title: action === "created" ? "Ocorrência registrada" : "Estado da ocorrência alterado",
    narrative: action === "created"
      ? "Ocorrência registrada com motivo."
      : `Ocorrência avançou para ${occurrence.state} com motivo.`,
    entityType: "occurrence",
    entityId: occurrence.id,
    actorId,
    action: `occurrence.${action}`,
    beforeState,
    afterState: stateSnapshot(occurrence),
    metadata: { reason },
  });
}

export async function createOccurrence(input: {
  personId: string;
  date: string;
  type: string;
  description: string;
  registeredBy: string;
  reason: string;
}): Promise<Occurrence> {
  const reason = normalizeReason(input.reason);
  if (!reason) throw new OccurrenceReasonRequiredError();

  return db.transaction(async (tx) => {
    const [occurrence] = await tx.insert(occurrencesTable).values({
      personId: input.personId,
      date: input.date,
      type: input.type.trim(),
      description: input.description.trim(),
      state: "aberta",
      registeredBy: input.registeredBy,
      reason,
    }).returning();
    if (!occurrence) throw new Error("Não foi possível criar a ocorrência.");
    await writeOccurrenceHistory(tx as unknown as typeof db, occurrence, null, reason, "created");
    return occurrence;
  });
}

export async function transitionOccurrence(input: {
  occurrenceId: string;
  to: OccurrenceState;
  registeredBy: string;
  reason: string;
}): Promise<Occurrence> {
  const reason = normalizeReason(input.reason);
  if (!reason) throw new OccurrenceReasonRequiredError();

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(occurrencesTable)
      .where(eq(occurrencesTable.id, input.occurrenceId))
      .limit(1);
    if (!current) throw new Error("Ocorrência não encontrada.");
    if (NEXT_STATE[current.state] !== input.to) {
      throw new InvalidOccurrenceTransitionError(current.state, input.to);
    }

    const [updated] = await tx
      .update(occurrencesTable)
      .set({ state: input.to, reason, updatedAt: new Date() })
      .where(and(
        eq(occurrencesTable.id, input.occurrenceId),
        eq(occurrencesTable.state, current.state),
      ))
      .returning();
    if (!updated) throw new Error("Ocorrência foi alterada antes da transição.");
    await writeOccurrenceHistory(
      tx as unknown as typeof db,
      updated,
      stateSnapshot(current),
      reason,
      `state_${input.to}`,
      input.registeredBy,
    );
    return updated;
  });
}
