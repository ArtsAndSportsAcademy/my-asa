export function isAsaProposalExpired(expiresAt: unknown, now = Date.now()): boolean {
  if (typeof expiresAt !== "string" || !expiresAt.trim()) return true;
  const deadline = Date.parse(expiresAt);
  return !Number.isFinite(deadline) || deadline <= now;
}
