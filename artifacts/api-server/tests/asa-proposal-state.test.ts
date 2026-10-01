import assert from "node:assert/strict";
import { isAsaProposalExpired } from "../src/services/asa-proposal-state.ts";

const now = Date.parse("2026-09-28T15:00:00.000Z");

assert.equal(isAsaProposalExpired("2026-09-28T15:01:00.000Z", now), false);
assert.equal(isAsaProposalExpired("2026-09-28T15:00:00.000Z", now), true);
assert.equal(isAsaProposalExpired("2026-09-28T14:59:59.999Z", now), true);
assert.equal(isAsaProposalExpired("not-a-date", now), true);
assert.equal(isAsaProposalExpired(undefined, now), true);
assert.equal(isAsaProposalExpired("", now), true);

console.log("ASA proposal state tests passed");
