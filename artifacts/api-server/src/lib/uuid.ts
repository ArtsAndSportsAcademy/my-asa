const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devolve true se o valor tem o formato de UUID (8-4-4-4-12 hex). */
export function validarUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}
