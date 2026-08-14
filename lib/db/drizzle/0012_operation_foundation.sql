ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "client_name" text;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "locations" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "end_date" date;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#6D4AFF' NOT NULL;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT 'sparkles' NOT NULL;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "local_coordinator_id" uuid;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "archived_by" uuid;

DO $$ BEGIN
 ALTER TABLE "operations" ADD CONSTRAINT "operations_local_coordinator_id_users_id_fk"
 FOREIGN KEY ("local_coordinator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operations" ADD CONSTRAINT "operations_archived_by_users_id_fk"
 FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
