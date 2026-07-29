---
name: migrate baseline on shared DB
description: Why post-merge `migrate` fails on the shared DB and how to baseline the drizzle journal
---

# Post-merge `migrate` + drizzle journal baseline

The new flow (replaces `drizzle-kit push`) runs `pnpm --filter @workspace/db run migrate`
(drizzle-orm node-postgres migrator) in `scripts/post-merge.sh`.

**Why it failed:** the drizzle migrator decides whether to apply each migration purely by
comparing the journal's `folderMillis` (the `when` in `lib/db/drizzle/meta/_journal.json`)
against the MAX `created_at` in `drizzle.__drizzle_migrations`. Hash is stored but NOT used
for the apply decision.

The shared dev/prod DB had an EMPTY `drizzle.__drizzle_migrations` even though its schema
was already built up over time (via push + ad-hoc executeSql). A task agent that "baselines"
the journal does it inside its OWN isolated DB — **only code merges, not DB state** — so the
shared DB journal stayed empty. With an empty journal, migrate tries to apply from 0000 →
`CREATE TYPE ... already exists` → `DefineEnum` error (typecmds.c) → post-merge exit 1.

**Fix pattern (run against shared DB via executeSql in code_execution):**
1. Create any genuinely-missing tables idempotently (`CREATE TABLE IF NOT EXISTS`) using the
   exact DDL from the migration `.sql` files; add FKs guarded by a `pg_constraint` check.
2. For tables with OLD/drifted structure AND 0 rows, `DROP ... CASCADE` + recreate from the
   migration DDL. NEVER drop a table that has rows (e.g. `daily_books` had 1 row → left as-is;
   it was already a column superset of the migration, so safe).
3. Baseline the journal: for each entry in `_journal.json`, compute `sha256sum <file>` and
   insert `(hash, created_at=when)` into **`drizzle.__drizzle_migrations`** — the schema is
   `drizzle`, NOT `public`. Guard inserts with `WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '...')`.
   A `public.__drizzle_migrations` also exists but is IGNORED by the migrator.
4. Verify `pnpm --filter @workspace/db run migrate` prints "Database is in sync"; then
   `runPostMergeSetup()` should return `success:true`.

**Drizzle migrator decision logic (v0.45):** applies a migration if
`migration.folderMillis > MAX(drizzle.__drizzle_migrations.created_at)`. Hash is stored but
not used for the skip/apply decision. Assign future migrations a `when` LARGER than the
current last entry in `_journal.json` to avoid stale-timestamp confusion.

**Why:** baselining makes migrate a no-op for already-applied migrations; future entries apply
cleanly. Drift reconciliation must be surgical because dev=prod share ONE DATABASE_URL with
live data (see dev-prod-shared-db.md).
