ALTER TABLE "scales"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

ALTER TABLE "notices"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text;

CREATE TABLE IF NOT EXISTS "rotation_daily_advances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "date" date NOT NULL,
  "source_line_id" uuid REFERENCES "show_book_lines"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rotation_daily_advances_character_user_date_uq"
  ON "rotation_daily_advances" ("character_id", "user_id", "date");
