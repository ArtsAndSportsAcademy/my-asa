const TEAM_SUMMARY_ROLES = new Set(["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]);

export function resolveAsaSummaryTeamOperation(
  role: string,
  selectedOperationId: string | null | undefined,
  authorizedOperationIds: readonly string[] | undefined,
): string | null {
  if (!TEAM_SUMMARY_ROLES.has(role) || !selectedOperationId) return null;
  return authorizedOperationIds?.includes(selectedOperationId) ? selectedOperationId : null;
}
