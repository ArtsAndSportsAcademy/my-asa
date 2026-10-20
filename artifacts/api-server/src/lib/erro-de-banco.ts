/** O banco recusou por valor repetido (índice único). Só isso justifica dizer "já existe"; qualquer outra falha é do servidor. */
export function isUniqueViolation(err: unknown): boolean {
  const error = err as { code?: string; cause?: { code?: string } } | null;
  return error?.code === "23505" || error?.cause?.code === "23505";
}
