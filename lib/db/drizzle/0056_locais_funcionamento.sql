ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "operating_days" jsonb NOT NULL DEFAULT '[1,2,3,4,5,6,0]'::jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "open_time" text NOT NULL DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "close_time" text NOT NULL DEFAULT '22:00';
