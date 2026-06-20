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

/** Limites de tamanho para um username escolhido pelo usuário. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Valida e normaliza um username escolhido manualmente (pelo usuário ou admin).
 *
 * Aplica a mesma normalização da geração automática (minúsculas, sem acentos,
 * espaços viram ponto, apenas letras/números/ponto) e valida o tamanho.
 * Retorna o username normalizado em caso de sucesso, ou uma mensagem de erro
 * clara em caso de formato inválido.
 */
export function validateAndNormalizeUsername(
  input: unknown,
): { ok: true; username: string } | { ok: false; message: string } {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, message: "O nome de usuário é obrigatório." };
  }

  // Aplica a normalização sem o fallback "usuario", para conseguir detectar
  // entradas que não contêm nenhum caractere válido.
  const username = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (!username || !/[a-z0-9]/.test(username)) {
    return {
      ok: false,
      message: "Use apenas letras, números e pontos (ex.: lucas.fernandes).",
    };
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `O nome de usuário deve ter pelo menos ${USERNAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `O nome de usuário deve ter no máximo ${USERNAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, username };
}
