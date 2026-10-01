-- Quadros-chave são entidades estáveis da Cena. O Livro do Dia referencia o
-- quadro `inicial`; as coordenadas dos marcadores permanecem no JSON do quadro
-- porque o mapa sempre é lido e desenhado como um conjunto.
DO $$
BEGIN
  CREATE TYPE show_book_keyframe_type AS ENUM ('inicial', 'splice', 'locacao', 'saida');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.show_book_keyframes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES public.show_book_scenes(id),
  "order" integer NOT NULL,
  name text NOT NULL,
  type show_book_keyframe_type,
  moment text,
  marker_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT show_book_keyframes_marker_positions_object_ck
    CHECK (jsonb_typeof(marker_positions) = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS show_book_keyframes_one_initial_per_scene_uq
  ON public.show_book_keyframes(scene_id)
  WHERE active AND type = 'inicial';
--> statement-breakpoint
ALTER TABLE public.daily_book_scenes
  ADD COLUMN IF NOT EXISTS source_keyframe_id uuid REFERENCES public.show_book_keyframes(id);
--> statement-breakpoint
-- O preset é por organização: mover DOWNSTAGE no L afeta todos os shows em L
-- daquela operação, sem vazar configuração entre organizações.
CREATE TABLE IF NOT EXISTS public.stage_format_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  format text NOT NULL CHECK (format IN ('L', 'RET', 'QUAD', 'NONE')),
  zone_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stage_format_presets_zone_positions_object_ck
    CHECK (jsonb_typeof(zone_positions) = 'object'),
  CONSTRAINT stage_format_presets_organization_format_uq UNIQUE (organization_id, format)
);
--> statement-breakpoint
ALTER TABLE public.show_book_keyframes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stage_format_presets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.show_book_keyframes, public.stage_format_presets FROM PUBLIC, anon, authenticated;
