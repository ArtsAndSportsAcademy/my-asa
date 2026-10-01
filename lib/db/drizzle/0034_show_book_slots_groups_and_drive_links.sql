-- Grupos livres de slot: o bloco de cena passa a declarar a zona do palco e
-- o prefixo da identidade visual (BL 01, PI 01 etc.).
ALTER TABLE public.show_book_blocks
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS prefix text;
--> statement-breakpoint
UPDATE public.show_book_blocks
SET prefix = CASE lower(name)
  WHEN 'backstage left' THEN 'BL'
  WHEN 'backstage right' THEN 'BR'
  WHEN 'papéis nomeados' THEN 'PER'
  WHEN 'papeis nomeados' THEN 'PER'
  ELSE 'GR'
END
WHERE prefix IS NULL;
--> statement-breakpoint
UPDATE public.show_book_blocks
SET zone = CASE prefix
  WHEN 'BL' THEN 'BACKSTAGE LEFT'
  WHEN 'BR' THEN 'BACKSTAGE RIGHT'
  WHEN 'PER' THEN 'CENTRO'
  ELSE 'CENTRO'
END
WHERE zone IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.show_book_drive_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_book_id uuid NOT NULL REFERENCES public.show_books(id),
  label text NOT NULL,
  url text,
  type text NOT NULL,
  scope text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS show_book_drive_links_book_order_idx
  ON public.show_book_drive_links(show_book_id, "order")
  WHERE active;
--> statement-breakpoint
ALTER TABLE public.show_book_drive_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.show_book_drive_links FROM PUBLIC, anon, authenticated;
