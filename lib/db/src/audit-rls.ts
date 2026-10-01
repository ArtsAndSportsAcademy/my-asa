/**
 * Inventário somente leitura de RLS e privilégios efetivos do papel `anon`.
 *
 * Uso: DATABASE_URL=... pnpm --filter @workspace/db exec tsx src/audit-rls.ts
 * O resultado não inclui URL, credenciais nem linhas de dados.
 */
import pg from "pg";
import { normalizeDatabaseUrl } from "./database-url.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) });

try {
  const { rows: environmentRows } = await pool.query(`
    SELECT current_user AS database_role, rolcreatedb AS can_create_database
    FROM pg_roles
    WHERE rolname = current_user
  `);
  const { rows } = await pool.query(`
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      owner_role.rolname AS owner,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced,
      has_schema_privilege('anon', n.oid, 'USAGE') AS anon_schema_usage,
      array_remove(ARRAY[
        CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'SELECT' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'INSERT' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'DELETE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
        CASE WHEN has_table_privilege('anon', c.oid, 'TRIGGER') THEN 'TRIGGER' END
      ], NULL) AS anon_effective_grants,
      COALESCE((
        SELECT array_agg(p.policyname ORDER BY p.policyname)
        FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname
      ), ARRAY[]::text[]) AS policies
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner_role ON owner_role.oid = c.relowner
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_'
    ORDER BY n.nspname, c.relname
  `);

  process.stdout.write(`${JSON.stringify({ environment: environmentRows[0], tables: rows }, null, 2)}\n`);
} finally {
  await pool.end();
}
