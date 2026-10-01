import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, scheduleConflictsTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import {
  acknowledgeScheduleConflict,
  detectAndPersistScheduleConflicts,
  listScheduleConflicts,
  ScheduleConflictAlreadyAcknowledgedError,
  ScheduleConflictNotActiveError,
  ScheduleConflictNotFoundError,
  ScheduleConflictReasonRequiredError,
} from "../services/schedule-conflicts.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Recalcula o dia antes de responder. Assim uma mudança de horário derruba
// automaticamente o reconhecimento antigo, sem exigir um job permanente.
router.get("/schedule-conflicts", requireAuth, requireOrganization, async (req, res) => {
  const user = req.user!;
  const query = req.query as Record<string, string | undefined>;
  const personId = query.personId ?? user.sub;
  const date = query.date;

  if (!validDate(date)) {
    res.status(400).json({ error: "date é obrigatório no formato YYYY-MM-DD" });
    return;
  }

  try {
    const [person] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId })
      .from(usersTable)
      .where(eq(usersTable.id, personId))
      .limit(1);
    if (!person || person.organizationId !== user.organizationId) {
      res.status(404).json({ error: "Pessoa não encontrada" });
      return;
    }
    if (personId !== user.sub && !MANAGER_ROLES.includes(user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Somente a gestão pode consultar conflitos de outra pessoa" });
      return;
    }

    await detectAndPersistScheduleConflicts(personId, date);
    const conflicts = await listScheduleConflicts(personId, date, true);
    res.json({
      conflicts,
      alerts: conflicts.filter((conflict) => conflict.state === "aberto"),
    });
  } catch (error) {
    console.error("erro ao detectar conflitos de horário", error);
    res.status(500).json({ error: "Erro ao detectar conflitos de horário" });
  }
});

router.post(
  "/schedule-conflicts/:id/acknowledge",
  requireAuth,
  requireOrganization,
  requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"),
  async (req, res) => {
    const id = req.params["id"] as string;
    const reason = req.body?.reason;

    try {
      const [conflict] = await db
        .select({ organizationId: scheduleConflictsTable.organizationId })
        .from(scheduleConflictsTable)
        .where(eq(scheduleConflictsTable.id, id))
        .limit(1);
      if (!conflict) {
        res.status(404).json({ error: "SCHEDULE_CONFLICT_NOT_FOUND", message: "Conflito de horário não encontrado." });
        return;
      }
      if (conflict.organizationId !== req.user!.organizationId) {
        res.status(404).json({ error: "SCHEDULE_CONFLICT_NOT_FOUND", message: "Conflito de horário não encontrado." });
        return;
      }

      const acknowledged = await acknowledgeScheduleConflict({
        conflictId: id,
        actorId: req.user!.sub,
        reason,
      });
      res.json({ conflict: acknowledged });
    } catch (error) {
      if (error instanceof ScheduleConflictReasonRequiredError) {
        res.status(400).json({ error: "REASON_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof ScheduleConflictNotFoundError) {
        res.status(404).json({ error: "SCHEDULE_CONFLICT_NOT_FOUND", message: error.message });
        return;
      }
      if (error instanceof ScheduleConflictAlreadyAcknowledgedError || error instanceof ScheduleConflictNotActiveError) {
        res.status(409).json({ error: "SCHEDULE_CONFLICT_NOT_ACTIVE", message: error.message });
        return;
      }
      console.error("erro ao reconhecer conflito de horário", error);
      res.status(500).json({ error: "Erro ao reconhecer conflito de horário" });
    }
  },
);

export default router;
