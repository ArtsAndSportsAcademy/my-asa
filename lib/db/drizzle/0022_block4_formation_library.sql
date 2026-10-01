ALTER TABLE "formations"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

ALTER TABLE "show_book_roles"
  ADD COLUMN IF NOT EXISTS "position_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
