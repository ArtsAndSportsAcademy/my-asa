/**
 * Prova que um banco Postgres vazio chega ao schema MyASA apenas com o migrador.
 *
 * Cria e remove um banco temporário no mesmo servidor apontado por DATABASE_URL.
 * Nunca toca no banco de origem. O papel precisa de CREATEDB; caso contrário a
 * falha é explícita, em vez de fingir que a validação aconteceu.
 */
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { applyMigrations } from "./migration-runner.js";
import { normalizeDatabaseUrl } from "./database-url.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");

const sourceUrl = new URL(normalizeDatabaseUrl(process.env.DATABASE_URL));
const temporaryDatabase = `myasa_schema_check_${Date.now()}_${randomBytes(4).toString("hex")}`;
if (!/^myasa_schema_check_[0-9]+_[a-f0-9]{8}$/.test(temporaryDatabase)) {
  throw new Error("Nome temporário inválido");
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const adminPool = new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL) });
let targetPool: pg.Pool | undefined;
let created = false;

try {
  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(temporaryDatabase)}`);
  created = true;

  const targetUrl = new URL(sourceUrl.toString());
  targetUrl.pathname = `/${temporaryDatabase}`;
  targetPool = new Pool({ connectionString: targetUrl.toString() });
  await applyMigrations(targetPool);

  const { rows: tables } = await targetPool.query(`
    SELECT c.relname, c.relrowsecurity,
      has_schema_privilege('anon', n.oid, 'USAGE') AS anon_schema_usage,
      has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
      has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
      has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
      has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `);
  const { rows: migrations } = await targetPool.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
  const defects = tables.filter((table) => !table.relrowsecurity || table.anon_schema_usage || table.anon_select || table.anon_insert || table.anon_update || table.anon_delete);
  if (tables.length === 0 || defects.length > 0) {
    throw new Error(`Schema vazio inseguro: ${defects.map((table) => table.relname).join(", ") || "sem tabelas"}`);
  }

  const report = {
    result: "ready",
    migrationCount: migrations[0]?.count ?? 0,
    publicTableCount: tables.length,
    rlsAndAnonGrantDefects: defects.length,
  };
  if (process.env.MYASA_EMPTY_SCHEMA_REPORT) {
    await writeFile(process.env.MYASA_EMPTY_SCHEMA_REPORT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await targetPool?.end();
  if (created) {
    // O pooler pode manter uma conexão de curta duração mesmo após `end()`.
    // FORCE limita a desconexão ao banco descartável criado por este verificador.
    await adminPool.query(`DROP DATABASE ${quoteIdentifier(temporaryDatabase)} WITH (FORCE)`);
  }
  await adminPool.end();
}
