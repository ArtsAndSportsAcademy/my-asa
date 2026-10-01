export type AsaMemoryPolicyRecord = {
  type: "PERSONAL" | "OPERATIONAL" | "OFFICIAL";
  createdBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
};

const MANAGER_ROLES = new Set(["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]);

export function canReadAsaMemory(userId: string, role: string, memory: AsaMemoryPolicyRecord): boolean {
  if (memory.type === "PERSONAL") return memory.createdBy === userId;
  return MANAGER_ROLES.has(role) || memory.status === "APPROVED";
}

export function canEditAsaMemory(userId: string, role: string, memory: AsaMemoryPolicyRecord): boolean {
  if (memory.type === "PERSONAL") return memory.createdBy === userId;
  return MANAGER_ROLES.has(role) || memory.createdBy === userId;
}

export function canApproveAsaMemory(userId: string, role: string, memory: AsaMemoryPolicyRecord): boolean {
  if (memory.type === "PERSONAL") return memory.createdBy === userId;
  return MANAGER_ROLES.has(role);
}

export function canDeleteAsaMemory(userId: string, role: string, memory: AsaMemoryPolicyRecord): boolean {
  if (memory.type === "PERSONAL") return memory.createdBy === userId;
  return MANAGER_ROLES.has(role) || memory.createdBy === userId;
}
