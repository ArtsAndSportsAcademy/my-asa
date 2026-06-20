/**
 * Geração de nome de usuário (username) a partir do nome da pessoa.
 *
 * Regra: minúsculas, sem acentos, espaços viram ponto, apenas letras/números/ponto.
 * Ex.: "Lucas Fernandes" -> "lucas.fernandes"
 * Colisões são resolvidas com sufixo numérico: "lucas.fernandes2", "lucas.fernandes3", ...
 */

/** Normaliza o nome em uma base de username (sem resolver colisões). */
export function normalizeUsernameBase(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.]/g, "") // mantém letras, números, espaços e pontos
    .replace(/\s+/g, ".") // espaços viram ponto
    .replace(/\.+/g, ".") // colapsa pontos repetidos
    .replace(/^\.+|\.+$/g, ""); // remove pontos nas pontas
  return base || "usuario";
}

/**
 * Resolve um username único a partir de uma base, evitando colisões com `taken`.
 * O primeiro disponível é a própria base; depois acrescenta sufixo numérico (2, 3, ...).
 */
export function resolveUniqueUsername(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) {
    n++;
  }
  return `${base}${n}`;
}

/** Atalho: gera username único a partir do nome e de um conjunto de usernames já usados. */
export function generateUniqueUsername(name: string, taken: Set<string>): string {
  return resolveUniqueUsername(normalizeUsernameBase(name), taken);
}
