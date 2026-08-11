ALTER TABLE "operational_groups" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "operational_groups" ADD COLUMN IF NOT EXISTS "color" text DEFAULT '#6D4AFF' NOT NULL;
ALTER TABLE "operational_groups" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT 'users' NOT NULL;

CREATE TABLE IF NOT EXISTS "team_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "operational_groups"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "is_primary" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "assigned_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_memberships_active_team_user_idx"
  ON "team_memberships" ("team_id", "user_id") WHERE "active" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "team_memberships_one_primary_idx"
  ON "team_memberships" ("user_id") WHERE "active" = true AND "is_primary" = true;

INSERT INTO "team_memberships" ("team_id", "user_id", "is_primary", "active", "starts_at", "created_at", "updated_at")
SELECT DISTINCT ON ("group_id", "user_id") "group_id", "user_id", false, true, "created_at", "created_at", now()
FROM "user_roles"
WHERE "group_id" IS NOT NULL AND "active" = true AND "role" = 'MEMBER'
ON CONFLICT DO NOTHING;
