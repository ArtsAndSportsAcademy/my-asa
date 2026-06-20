/**
 * Backfill idempotente de `username` para usuários existentes.
 *
 * Gera um nome de usuário único a partir do nome de cada usuário que ainda
 * não possui um. Usuários que já têm `username` são ignorados (idempotente).
 *
 * Pode ser executado diretamente: `tsx src/backfill-usernames.ts`
 */

import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { usersTable } from "./schema/index.js";
import { normalizeUsernameBase, resolveUniqueUsername } from "./username.js";

export async function backfillUsernames(): Promise<number> {
  const all = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username })
    .from(usersTable);

  const taken = new Set(
    all.map((u) => u.username).filter((u): u is string => !!u),
  );

  let filled = 0;
  for (const u of all) {
    if (u.username) continue;
    const username = resolveUniqueUsername(normalizeUsernameBase(u.name), taken);
    taken.add(username);
    await db.update(usersTable).set({ username }).where(eq(usersTable.id, u.id));
    filled++;
  }

  return filled;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillUsernames()
    .then((n) => {
      console.log(`✅ Backfill de username concluído: ${n} usuário(s) atualizado(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Erro no backfill de username:", err);
      process.exit(1);
    });
}
