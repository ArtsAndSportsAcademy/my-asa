ALTER TABLE "operations" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "activated_by" uuid;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "modules_reviewed_at" timestamp with time zone;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "modules_reviewed_by" uuid;

DO $$ BEGIN
 ALTER TABLE "operations" ADD CONSTRAINT "operations_activated_by_users_id_fk"
 FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operations" ADD CONSTRAINT "operations_modules_reviewed_by_users_id_fk"
 FOREIGN KEY ("modules_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "operations_organization_normalized_name_idx"
  ON "operations" (
    "organization_id",
    lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'))
  );
