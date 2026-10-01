import type { Request } from "express";
import { writeHistoryEvent, type HistoryExecutor, type WriteHistoryEventInput } from "./history-helper.js";
import { normalizeReason } from "./reason.js";
import { diffSnapshots } from "./versioning.js";

/** Registro das entidades HTTP: preserva motivo opcional informado e, quando
 * vazio, guarda o reflexo calculado. O executor da transação é obrigatório. */
export function writeEntityHistory(req: Request, input: WriteHistoryEventInput, tx: HistoryExecutor) {
  const reason = normalizeReason(req.body?.reason) ?? normalizeReason(input.metadata?.reason);
  const reflection = (diffSnapshots(input.beforeState ?? {}, input.afterState ?? {}) ?? [])
    .filter((change) => !change.path.endsWith(".updatedAt"))
    .map((change) => change.message);
  return writeHistoryEvent({
    ...input,
    metadata: { ...input.metadata, reason, ...(!reason ? { reflection } : {}) },
  }, tx);
}
