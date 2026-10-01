const PROJECT_REF_PATTERN = /^[a-z0-9]+$/;

export function isSupabaseTestDatabaseUrl(value, projectRef) {
  const ref = projectRef?.trim().toLowerCase();
  if (!value || !ref || !PROJECT_REF_PATTERN.test(ref)) return false;

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;

  const host = url.hostname.toLowerCase();
  if (host === `db.${ref}.supabase.co`) return true;
  return host.endsWith(".pooler.supabase.com") && url.username.toLowerCase() === `postgres.${ref}`;
}

export function databaseIdentity(value) {
  const url = new URL(value);
  return `${url.hostname}:${url.port || "5432"}/${url.username}/${url.pathname}`;
}

export function sameTestDatabaseOrProject(first, second, projectRef) {
  if (!first || !second) return false;
  try {
    if (databaseIdentity(first) === databaseIdentity(second)) return true;
  } catch {
    return false;
  }
  return isSupabaseTestDatabaseUrl(first, projectRef) && isSupabaseTestDatabaseUrl(second, projectRef);
}
