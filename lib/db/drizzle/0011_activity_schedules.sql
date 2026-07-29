-- Create the new recurring_activity_schedules child table
CREATE TABLE "recurring_activity_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"weekday" integer,
	"specific_date" text,
	"start_time" text,
	"end_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Backfill: migrate every existing activity row that has a weekday or specificDate
INSERT INTO "recurring_activity_schedules" ("activity_id", "weekday", "specific_date", "start_time", "end_time")
SELECT "id", "weekday", "specific_date", "start_time", "end_time"
FROM "recurring_activities"
WHERE "weekday" IS NOT NULL OR "specific_date" IS NOT NULL;
--> statement-breakpoint

-- Add FK constraint
ALTER TABLE "recurring_activity_schedules"
  ADD CONSTRAINT "recurring_activity_schedules_activity_id_recurring_activities_id_fk"
  FOREIGN KEY ("activity_id") REFERENCES "public"."recurring_activities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- Drop legacy schedule columns from the parent table
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "weekday";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "specific_date";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "start_time";
--> statement-breakpoint
ALTER TABLE "recurring_activities" DROP COLUMN IF EXISTS "end_time";
