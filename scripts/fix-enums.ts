import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function exec(label: string, query: string) {
  await db.execute(sql.raw(query));
  console.log(`  ✓ ${label}`);
}

async function run() {
  // ── 1. Fix daily_book_status ──
  console.log("1. Fixing daily_book_status...");
  await exec("column to text", "ALTER TABLE daily_books ALTER COLUMN status TYPE text");
  await exec("drop old enum", "DROP TYPE IF EXISTS daily_book_status");
  await exec("create new enum", "CREATE TYPE daily_book_status AS ENUM ('DRAFT','PUBLISHED','REPUBLISHED','EXECUTED','CANCELLED')");
  await exec("restore column", "ALTER TABLE daily_books ALTER COLUMN status TYPE daily_book_status USING status::daily_book_status");

  // ── 2. Add daily_book_assignment_status if missing ──
  console.log("2. daily_book_assignment_status...");
  await exec("create if not exists",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_book_assignment_status') THEN
         CREATE TYPE daily_book_assignment_status AS ENUM ('ASSIGNED','AT_RISK','OPEN','REMOVED');
       END IF;
     END $$`
  );

  // ── 3. New notice enums ──
  console.log("3. New notice enums...");
  await exec("notice_type",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_type') THEN
         CREATE TYPE notice_type AS ENUM ('INFORMATIVE','IMPORTANT','PERSISTENT','ESCALATED');
       END IF;
     END $$`
  );
  await exec("notice_status",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_status') THEN
         CREATE TYPE notice_status AS ENUM ('DRAFT','PUBLISHED','EXPIRED','CANCELLED');
       END IF;
     END $$`
  );
  await exec("notice_recipient_status",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_recipient_status') THEN
         CREATE TYPE notice_recipient_status AS ENUM ('PENDING','SENT','VIEWED','CONFIRMED','ESCALATED');
       END IF;
     END $$`
  );

  // ── 4. Extend notices table ──
  console.log("4. Extending notices table...");
  const noticeAlters = [
    `ALTER TABLE notices ALTER COLUMN urgency SET DEFAULT 'INFORMATIVE'`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS type notice_type NOT NULL DEFAULT 'INFORMATIVE'`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS status notice_status NOT NULL DEFAULT 'DRAFT'`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS title text`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT false`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS delta_json jsonb`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS source_type text`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS source_id text`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS published_at timestamptz`,
    `ALTER TABLE notices ADD COLUMN IF NOT EXISTS expires_at timestamptz`,
  ];
  for (const q of noticeAlters) await exec(q.slice(0, 60), q);

  // ── 5. Create notice_recipients table ──
  console.log("5. Creating notice_recipients table...");
  await exec("notice_recipients",
    `CREATE TABLE IF NOT EXISTS notice_recipients (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       notice_id uuid NOT NULL REFERENCES notices(id),
       user_id uuid NOT NULL REFERENCES users(id),
       group_id uuid REFERENCES operational_groups(id),
       status notice_recipient_status NOT NULL DEFAULT 'PENDING',
       sent_at timestamptz,
       viewed_at timestamptz,
       confirmed_at timestamptz,
       escalated_at timestamptz,
       created_at timestamptz NOT NULL DEFAULT now()
     )`
  );

  // ── 6. Create notice_escalations table ──
  console.log("6. Creating notice_escalations table...");
  await exec("notice_escalations",
    `CREATE TABLE IF NOT EXISTS notice_escalations (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       notice_id uuid NOT NULL REFERENCES notices(id),
       recipient_id uuid NOT NULL REFERENCES users(id),
       escalated_by uuid REFERENCES users(id),
       reason text,
       escalated_at timestamptz NOT NULL DEFAULT now(),
       resolved_at timestamptz,
       created_at timestamptz NOT NULL DEFAULT now()
     )`
  );

  // ── 7. Add daily_book_assignment_status column if table exists ──
  console.log("7. daily_book_assignments status column...");
  await exec("check/add column",
    `DO $$ BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='daily_book_assignments')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_book_assignments' AND column_name='status' AND udt_name='daily_book_assignment_status') THEN
         ALTER TABLE daily_book_assignments ALTER COLUMN status TYPE daily_book_assignment_status USING status::daily_book_assignment_status;
       END IF;
     END $$`
  );

  console.log("\n✅ Migration complete.");
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
