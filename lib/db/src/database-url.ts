/**
 * Normaliza as credenciais de uma URL PostgreSQL antes de entregá-la ao `pg`.
 *
 * Senhas geradas pelo Supabase podem conter caracteres reservados de URL (por
 * exemplo, `@`). WHATWG URL identifica corretamente o host, e ao reatribuir
 * usuário e senha ele os serializa com escape percent-encoded para o parser do
 * driver PostgreSQL. Não registra a URL nem as credenciais.
 */
function decodeUrlComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.username = decodeUrlComponent(url.username);
  url.password = decodeUrlComponent(url.password);
  return url.toString();
}
