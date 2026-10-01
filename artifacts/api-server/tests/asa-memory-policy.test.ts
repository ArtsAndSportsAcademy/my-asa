import assert from "node:assert/strict";
import { canApproveAsaMemory, canDeleteAsaMemory, canEditAsaMemory, canReadAsaMemory } from "../src/services/asa-memory-policy.ts";

const personal = { type: "PERSONAL", createdBy: "member-a", status: "APPROVED" } as const;
const disabledPersonal = { type: "PERSONAL", createdBy: "member-a", status: "DISABLED" } as const;
const pendingShared = { type: "OPERATIONAL", createdBy: "manager-a", status: "PENDING" } as const;
const approvedShared = { type: "OPERATIONAL", createdBy: "manager-a", status: "APPROVED" } as const;

assert.equal(canReadAsaMemory("member-a", "MEMBER", personal), true);
assert.equal(canReadAsaMemory("member-b", "ADMIN", personal), false);
assert.equal(canReadAsaMemory("member-a", "MEMBER", disabledPersonal), true);
assert.equal(canReadAsaMemory("member-b", "ADMIN", disabledPersonal), false);
assert.equal(canReadAsaMemory("member-b", "MEMBER", pendingShared), false);
assert.equal(canReadAsaMemory("member-b", "MEMBER", approvedShared), true);
assert.equal(canReadAsaMemory("member-b", "ADMIN", pendingShared), true);
assert.equal(canApproveAsaMemory("member-a", "MEMBER", personal), true);
assert.equal(canApproveAsaMemory("member-a", "MEMBER", disabledPersonal), true);
assert.equal(canApproveAsaMemory("member-b", "ADMIN", personal), false);
assert.equal(canApproveAsaMemory("manager-a", "ADMIN", pendingShared), true);
assert.equal(canEditAsaMemory("member-b", "MEMBER", approvedShared), false);
assert.equal(canEditAsaMemory("manager-a", "ADMIN", approvedShared), true);
assert.equal(canDeleteAsaMemory("member-b", "ADMIN", personal), false);
assert.equal(canDeleteAsaMemory("manager-a", "ADMIN", approvedShared), true);

console.log("ASA memory policy tests passed");
