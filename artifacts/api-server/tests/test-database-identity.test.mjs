import assert from "node:assert/strict";
import { isSupabaseTestDatabaseUrl, sameTestDatabaseOrProject } from "../scripts/test-database-identity.mjs";

const ref = "asatestproject42";

assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres`, ref), true);
assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres.${ref}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`, ref), true);
assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres.otherproject:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`, ref), false);
assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres:secret@db.otherproject.supabase.co:5432/postgres?application_name=${ref}`, ref), false);
assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres.${ref}:secret@localhost:5432/myasa`, ref), false);
assert.equal(isSupabaseTestDatabaseUrl(`postgresql://postgres:secret@db.${ref}.supabase.co.attacker.example:5432/postgres`, ref), false);
assert.equal(isSupabaseTestDatabaseUrl("not a URL", ref), false);
assert.equal(isSupabaseTestDatabaseUrl(undefined, ref), false);
assert.equal(sameTestDatabaseOrProject(`postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres`, `postgresql://postgres.${ref}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`, ref), true);
assert.equal(sameTestDatabaseOrProject(`postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres`, "postgresql://postgres:secret@db.otherproject.supabase.co:5432/postgres", ref), false);

process.stdout.write("Test database identity guards passed (10 cases).\n");
