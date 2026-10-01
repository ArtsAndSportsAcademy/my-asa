import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, occurrencesTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requireReason } from "../lib/reason.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import {
  createOccurrence,
  InvalidOccurrenceTransitionError,
  OccurrenceReasonRequiredError,
  transitionOccurrence,
  type OccurrenceState,
} from "../services/occurrence-lifecycle.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";

const router: IRouter = Router();
const SUPERVISOR_ROLES = new Set(["SUPERVISOR_A", "SUPERVISOR_B"]);

async function occurrenceInOrganization(id: string, organizationId: string) {
  const [row] = await db
    .select({ occurrence: occurrencesTable, personName: usersTable.name })
    .from(occurrencesTable)
    .innerJoin(usersTable, eq(occurrencesTable.personId, usersTable.id))
    .where(and(eq(occurrencesTable.id, id), eq(usersTable.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

async function canReadOccurrence(actor: NonNullable<Express.Request["user"]>, personId: string): Promise<boolean> {
  const [person] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, personId), eq(usersTable.organizationId, actor.organizationId))).limit(1);
  if (!person) return false;
  if (actor.role === "ADMIN" || actor.role === "DIR" || actor.sub === personId) return true;
  if (!SUPERVISOR_ROLES.has(actor.role)) return false;
  return canSupervisorAccessPerson({
    supervisorId: actor.sub,
    organizationId: actor.organizationId,
    personId,
  });
}

async function canWriteOccurrence(actor: NonNullable<Express.Request["user"]>, personId: string): Promise<boolean> {
  if (actor.role === "DIR") return false;
  return canReadOccurrence(actor, personId);
}

router.get("/occurrences", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  const { personId, from, to, state } = req.query as Record<string, string | undefined>;
  try {
    if (personId && !(await canReadOccurrence(actor, personId))) { res.status(403).json({ error: "Forbidden" }); return; }
    const conditions = [eq(usersTable.organizationId, actor.organizationId), eq(occurrencesTable.active, true)];
    if (personId) conditions.push(eq(occurrencesTable.personId, personId));
    if (from) conditions.push(gte(occurrencesTable.date, from));
    if (to) conditions.push(lte(occurrencesTable.date, to));
    if (state && ["aberta", "em_analise", "resolvida"].includes(state)) {
      conditions.push(eq(occurrencesTable.state, state as OccurrenceState));
    }
    const rows = await db
      .select({ occurrence: occurrencesTable, personName: usersTable.name })
      .from(occurrencesTable)
      .innerJoin(usersTable, eq(occurrencesTable.personId, usersTable.id))
      .where(and(...conditions))
      .orderBy(occurrencesTable.date);
    const allowed = [] as typeof rows;
    for (const row of rows) {
      if (await canReadOccurrence(actor, row.occurrence.personId)) allowed.push(row);
    }
    res.json({ occurrences: allowed.map((row) => ({ ...row.occurrence, personName: row.personName })) });
  } catch (error) {
    console.error("erro ao listar ocorrências", error);
    res.status(500).json({ error: "Erro ao listar ocorrências" });
  }
});

router.get("/occurrences/:id", requireAuth, requireOrganization, async (req, res) => {
  try {
    const row = await occurrenceInOrganization(req.params.id as string, req.user!.organizationId);
    if (!row) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
    if (!(await canReadOccurrence(req.user!, row.occurrence.personId))) { res.status(403).json({ error: "Forbidden" }); return; }
    res.json({ occurrence: { ...row.occurrence, personName: row.personName } });
  } catch (error) {
    console.error("erro ao buscar ocorrência", error);
    res.status(500).json({ error: "Erro ao buscar ocorrência" });
  }
});

router.post("/occurrences", requireAuth, requireOrganization, async (req, res) => {
  const { personId, date, type, description, reason } = req.body ?? {};
  if (![personId, date, type, description].every((value) => typeof value === "string" && value.trim())) {
    res.status(400).json({ error: "personId, date, type e description são obrigatórios" });
    return;
  }
  if (!(await canWriteOccurrence(req.user!, personId))) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const occurrence = await createOccurrence({ personId, date, type, description, reason, registeredBy: req.user!.sub });
    res.status(201).json({ occurrence });
  } catch (error) {
    if (error instanceof OccurrenceReasonRequiredError) { res.status(400).json({ error: "REASON_REQUIRED", message: error.message }); return; }
    console.error("erro ao criar ocorrência", error);
    res.status(500).json({ error: "Erro ao criar ocorrência" });
  }
});

router.patch("/occurrences/:id", requireAuth, requireOrganization, async (req, res) => {
  try {
    const row = await occurrenceInOrganization(req.params.id as string, req.user!.organizationId);
    if (!row) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
    if (!(await canWriteOccurrence(req.user!, row.occurrence.personId))) { res.status(403).json({ error: "Forbidden" }); return; }
    const reason = requireReason(res, req.body?.reason, "alterar ocorrência");
    if (!reason) return;
    const before = row.occurrence;
    const next = {
      date: typeof req.body?.date === "string" ? req.body.date : before.date,
      type: typeof req.body?.type === "string" ? req.body.type.trim() : before.type,
      description: typeof req.body?.description === "string" ? req.body.description.trim() : before.description,
      reason,
      updatedAt: new Date(),
    };
    if (!next.type || !next.description) { res.status(400).json({ error: "type e description não podem ficar vazios" }); return; }
    const occurrence = await db.transaction(async (tx) => {
      const [updated] = await tx.update(occurrencesTable).set(next).where(eq(occurrencesTable.id, before.id)).returning();
      if (!updated) throw new Error("Ocorrência não encontrada");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "occurrence.updated", title: "Ocorrência alterada",
        narrative: "Dados da ocorrência alterados com motivo.", entityType: "occurrence", entityId: updated.id,
        actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: updated,
        metadata: { reason },
      }, tx as any);
      return updated;
    });
    res.json({ occurrence });
  } catch (error) {
    console.error("erro ao alterar ocorrência", error);
    res.status(500).json({ error: "Erro ao alterar ocorrência" });
  }
});

router.patch("/occurrences/:id/state", requireAuth, requireOrganization, async (req, res) => {
  const to = req.body?.state as OccurrenceState | undefined;
  if (!to || !["aberta", "em_analise", "resolvida"].includes(to)) { res.status(400).json({ error: "state inválido" }); return; }
  try {
    const row = await occurrenceInOrganization(req.params.id as string, req.user!.organizationId);
    if (!row) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
    if (!(await canWriteOccurrence(req.user!, row.occurrence.personId))) { res.status(403).json({ error: "Forbidden" }); return; }
    const occurrence = await transitionOccurrence({ occurrenceId: row.occurrence.id, to, registeredBy: req.user!.sub, reason: req.body?.reason });
    res.json({ occurrence });
  } catch (error) {
    if (error instanceof OccurrenceReasonRequiredError) { res.status(400).json({ error: "REASON_REQUIRED", message: error.message }); return; }
    if (error instanceof InvalidOccurrenceTransitionError) { res.status(409).json({ error: "INVALID_STATE_TRANSITION", message: error.message }); return; }
    console.error("erro ao transicionar ocorrência", error);
    res.status(500).json({ error: "Erro ao transicionar ocorrência" });
  }
});

router.delete("/occurrences/:id", requireAuth, requireOrganization, async (req, res) => {
  const row = await occurrenceInOrganization(req.params.id as string, req.user!.organizationId);
  if (!row) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!(await canWriteOccurrence(req.user!, row.occurrence.personId))) { res.status(403).json({ error: "Forbidden" }); return; }
  const reason = requireReason(res, req.body?.reason, "desativar ocorrência");
  if (!reason) return;
  const occurrence = await db.transaction(async (tx) => {
    const [next] = await tx.update(occurrencesTable).set({ active: false, reason, updatedAt: new Date() })
      .where(eq(occurrencesTable.id, row.occurrence.id)).returning();
    if (!next) throw new Error("Ocorrência não encontrada");
    await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "occurrence.deactivated",
      title: "Ocorrência desativada", narrative: "Ocorrência preservada no histórico.",
      entityType: "occurrence", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId,
      beforeState: row.occurrence, afterState: next, metadata: { reason } }, tx);
    return next;
  });
  res.json({ occurrence });
});

export default router;
