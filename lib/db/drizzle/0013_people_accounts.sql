DO $$ BEGIN
 CREATE TYPE "public"."person_status" AS ENUM('ACTIVE', 'ON_LEAVE', 'LEFT', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "person_status" "person_status" DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "professional_profile" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "primary_function" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "entry_date" date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_notes" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contact_visibility" jsonb DEFAULT '{"email":true,"phone":true}'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_by" uuid;
