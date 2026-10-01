-- Biblioteca institucional: arquivo, escopo e confirmação de leitura.
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS file_url text;
--> statement-breakpoint
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'HOUSE';
--> statement-breakpoint
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);
--> statement-breakpoint
ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
--> statement-breakpoint
ALTER TABLE library_documents ADD CONSTRAINT library_documents_scope_ck CHECK (
  scope_type IN ('HOUSE','AREA','LOCATION') AND
  ((scope_type = 'HOUSE' AND area_id IS NULL AND location_id IS NULL) OR (scope_type = 'AREA' AND area_id IS NOT NULL) OR (scope_type = 'LOCATION' AND location_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE library_views ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
--> statement-breakpoint
ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.library_views ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.library_documents, public.library_views FROM PUBLIC, anon, authenticated;
