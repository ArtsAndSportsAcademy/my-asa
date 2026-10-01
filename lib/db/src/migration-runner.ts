import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

/** Aplica o bootstrap mínimo e todas as migrations versionadas ao pool dado. */
export async function applyMigrations(pool: Pool): Promise<void> {
  // `gen_random_uuid()` aparece desde a primeira migração. Projetos Supabase
  // normalmente já trazem pgcrypto, mas este bootstrap deixa um banco novo
  // reproduzível sem um passo manual no SQL Editor.
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  const here = path.dirname(fileURLToPath(import.meta.url));
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(here, "../drizzle") });

  // Impede que uma migração futura exponha uma tabela nova por esquecimento.
  // A API usa o papel do servidor; o Data API não recebe grants no schema público.
  const { rows } = await pool.query<{ table_name: string }>(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND (
        NOT c.relrowsecurity
        OR has_schema_privilege('anon', n.oid, 'USAGE')
        OR has_table_privilege('anon', c.oid, 'SELECT')
        OR has_table_privilege('anon', c.oid, 'INSERT')
        OR has_table_privilege('anon', c.oid, 'UPDATE')
        OR has_table_privilege('anon', c.oid, 'DELETE')
      )
    ORDER BY c.relname
  `);
  if (rows.length > 0) {
    throw new Error(`Migração deixou tabelas públicas expostas: ${rows.map((row) => row.table_name).join(", ")}`);
  }
}
