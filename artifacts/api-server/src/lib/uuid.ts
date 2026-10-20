const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devolve true se o valor tem o formato de UUID (8-4-4-4-12 hex). */
export function validarUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

/**
 * Faz toda rota do roteador com estes parâmetros responder 404 com frase quando o valor não é um UUID
 * (`/tasks/undefined`), em vez de deixar o banco estourar e a pessoa ver "erro interno" (500).
 * Vale para qualquer rota declarada com o parâmetro, inclusive as que ainda vão ser escritas.
 */
export function exigirUuidNosParametros(router: { param: (nome: string, fn: (req: any, res: any, next: () => void, valor: string) => void) => unknown }, frases: Record<string, string>): void {
  for (const [nome, frase] of Object.entries(frases)) {
    router.param(nome, (_req, res, next, valor) => {
      if (validarUuid(valor)) return next();
      res.status(404).json({ error: "NAO_ENCONTRADO", message: frase });
    });
  }
}
