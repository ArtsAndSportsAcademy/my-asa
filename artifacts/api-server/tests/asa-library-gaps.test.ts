import assert from "node:assert/strict";
import { aggregateAsaLibraryGaps, createAsaLibraryGapAction, ASA_LIBRARY_NO_SOURCE_ACTION } from "../src/services/asa-library-gaps.ts";

assert.deepEqual(createAsaLibraryGapAction("procedimento de figurino"), {
  action: ASA_LIBRARY_NO_SOURCE_ACTION,
  topic: "procedimento de figurino",
});
assert.equal(createAsaLibraryGapAction("  "), null);
assert.match(createAsaLibraryGapAction("contato ana@example.com telefone 11987654321")!.topic, /\[email\].*\[telefone\]/);
assert.match(createAsaLibraryGapAction("documento", "Teatro")!.topic, /local Teatro/);

const signals = aggregateAsaLibraryGaps([
  { actionsExecuted: [{ action: ASA_LIBRARY_NO_SOURCE_ACTION, topic: "Procedimento de Figurino" }], createdAt: "2026-09-29T12:00:00.000Z" },
  { actionsExecuted: [{ action: ASA_LIBRARY_NO_SOURCE_ACTION, topic: "procedimento de figurino" }], createdAt: new Date("2026-10-01T12:00:00.000Z") },
  { actionsExecuted: [{ action: ASA_LIBRARY_NO_SOURCE_ACTION, topic: "segurança no gelo" }], createdAt: "2026-09-30T12:00:00.000Z" },
  { actionsExecuted: [{ action: "OTHER_ACTION", topic: "segredo" }], createdAt: "2026-10-01T12:00:00.000Z" },
  { actionsExecuted: null, createdAt: "2026-10-01T12:00:00.000Z" },
  { actionsExecuted: [{ action: ASA_LIBRARY_NO_SOURCE_ACTION, topic: "sem data" }], createdAt: "invalid" },
]);
assert.deepEqual(signals, [
  { topic: "Procedimento de Figurino", count: 2, lastSeen: "2026-10-01T12:00:00.000Z" },
  { topic: "segurança no gelo", count: 1, lastSeen: "2026-09-30T12:00:00.000Z" },
]);
assert.equal(aggregateAsaLibraryGaps([{ actionsExecuted: [{ action: ASA_LIBRARY_NO_SOURCE_ACTION, topic: "a" }], createdAt: new Date() }], -1).length, 0);
process.stdout.write("ASA library gap aggregation tests passed.\n");
