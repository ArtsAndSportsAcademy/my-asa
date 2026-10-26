/**
 * Nome de uma pessoa numa lista de Folgas. Pessoa desligada com o primeiro nome igual ao de outra ("Pessoa", "Pessoa")
 * ficava indistinguível; ela aparece com o nome completo e a marca "(desligado)". Quem está ativa mantém o nome de sempre.
 */
export function nomeNaLista(pessoa: { name: string; fullName?: string | null; personStatus?: string | null }): string {
  const desligada = pessoa.personStatus === "LEFT" || pessoa.personStatus === "ARCHIVED";
  return desligada ? `${pessoa.fullName?.trim() || pessoa.name} (desligado)` : pessoa.name;
}
