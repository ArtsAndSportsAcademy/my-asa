import type { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, operationalCheckInsTable } from "@workspace/db";
import { operationalDate } from "../lib/operational-date.js";
import { shiftsForDate, validShiftDate } from "../services/shift-checkins.js";

/** Escritores legados nunca contornam a janela nem encerram uma ocorrência nova. */
export const protectShiftCheckIns: RequestHandler = async (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) { next(); return; }
  const actor = req.user!;
  const date = typeof req.body?.date === "string" && validShiftDate(req.body.date) ? req.body.date : operationalDate();
  let protectedRecord = false;
  const id = req.path.split("/").filter(Boolean).at(-1);
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const [row] = await db.select({ shiftId: operationalCheckInsTable.shiftId }).from(operationalCheckInsTable).where(and(eq(operationalCheckInsTable.id, id), eq(operationalCheckInsTable.orgId, actor.organizationId)));
    protectedRecord = Boolean(row?.shiftId);
  }
  if (protectedRecord || (await shiftsForDate(actor.organizationId, date)).length) {
    res.status(409).json({ message: "Use o check-in por turno.", code: "SHIFT_CHECKIN_REQUIRED" }); return;
  }
  next();
};
