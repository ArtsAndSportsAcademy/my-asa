ALTER TABLE public.show_books
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_validity_range_ck;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_validity_range_ck
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
