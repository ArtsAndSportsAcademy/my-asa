import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { normalizeDatabaseUrl } from "./database-url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Cada instância da API abre até `max` conexões. Com o pooler do Supabase em modo transação (porta 6543) o
// limite do servidor é folgado e o padrão do pg (10) serve; DB_POOL_MAX existe para baixar o teto numa
// instância específica (por exemplo, a de teste, que roda junto de outra) sem mexer no código.
const poolMax = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
export const pool = new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  ...(Number.isInteger(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./username";
