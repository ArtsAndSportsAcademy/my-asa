/**
 * A frase que o servidor mandou, quando ele mandou uma (ex.: "Escolha hoje ou uma data futura.").
 * Sem ela — rede fora do ar, servidor caído — vale o texto padrão da tela. Assim a pessoa lê o que
 * de fato deu errado, e não um "não consegui" genérico para uma recusa que tinha explicação.
 */
export function mensagemDoErro(e: unknown, padrao: string): string {
  const data = (e as { data?: { message?: string } } | null)?.data;
  return typeof data?.message === "string" && data.message ? data.message : padrao;
}
