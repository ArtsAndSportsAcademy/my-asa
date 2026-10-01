/**
 * Aplica as migrations do Drizzle ao banco apontado por DATABASE_URL.
 *
 * Substitui o `drizzle-kit push`, que exige um terminal interativo (TTY) para
 * resolver conflitos de schema e por isso NÃO roda no ambiente não-interativo
 * (post-merge, CI). O `migrate` apenas reaplica os arquivos SQL já gerados em
 * `lib/db/drizzle/`, é 100% não-interativo e mantém o banco 1:1 com o schema em
 * `lib/db/src/schema/`.
 *
 * Fluxo ao alterar o schema:
 *   1. editar `lib/db/src/schema/*.ts`
 *   2. `pnpm --filter @workspace/db run generate`  (cria a migration SQL)
 *   3. `pnpm --filter @workspace/db run migrate`    (aplica — sem TTY)
 *
 * Rode diretamente com: `pnpm --filter @workspace/db run migrate`.
 */
import pg from "pg";
import { applyMigrations } from "./migration-runner.js";
import { normalizeDatabaseUrl } from "./database-url.js";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pool = new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) });

  try {
    console.log("Applying migrations from lib/db/drizzle ...");
    await applyMigrations(pool);
    console.log("Migrations applied. Database is in sync with the schema.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
