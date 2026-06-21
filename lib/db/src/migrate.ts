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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(here, "../drizzle");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    console.log(`Applying migrations from ${migrationsFolder} ...`);
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied. Database is in sync with the schema.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
