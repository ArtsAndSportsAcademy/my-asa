-- Create the new recurring_activity_schedules child table (idempotent)
CREATE TABLE IF NOT EXISTS "recurring_activity_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"weekday" integer,
	"specific_date" text,
	"start_time" text,
	"end_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Backfill: only migrate rows that don't already have a schedule entry (idempotent)
INSERT INTO "recurring_activity_schedules" ("activity_id", "weekday", "specific_date", "start_time", "end_time")
SELECT ra."id", ra."weekday", ra."specific_date", ra."start_time", ra."end_time"
FROM "recurring_activities" ra
WHERE (ra."weekday" IS NOT NULL OR ra."specific_date" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "recurring_activity_schedules" s WHERE s."activity_id" = ra."id"
  );
--> statement-breakpoint

-- Add FK constraint if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recurring_activity_schedules_activity_id_recurring_activities_id_fk'
  ) THEN
    ALTER TABLE "recurring_activity_schedules"
      ADD CONSTRAINT "recurring_activity_schedules_activity_id_recurring_activities_id_fk"
      FOREIGN KEY ("activity_id") REFERENCES "public"."recurring_activities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END$$;
--> statement-breakpoint

-- Drop legacy schedule columns from the parent table (IF EXISTS makes it idempotent)
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "weekday";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "specific_date";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "start_time";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "end_time";
