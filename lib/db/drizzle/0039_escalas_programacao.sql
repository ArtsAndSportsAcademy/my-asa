-- 15 Escalas: Programação (molde por local, com vigência e regra por bloco), áreas prontas da
-- Escala do dia e marca de "alterada depois de publicada". Só aditiva; nada é apagado.
ALTER TABLE scales ADD COLUMN IF NOT EXISTS alterada_desde timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS programacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  nome text NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programacoes_vigencia_ck CHECK (vigencia_fim >= vigencia_inicio)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS programacoes_local_vigencia_idx ON programacoes (location_id, vigencia_inicio, vigencia_fim);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS programacao_blocos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES programacoes(id),
  weekday integer NOT NULL,
  inicio time NOT NULL,
  fim time,
  rotulo text NOT NULL,
  regra text NOT NULL,
  show_book_id uuid REFERENCES show_books(id),
  area_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  grupo_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  pessoa_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  "order" integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programacao_blocos_weekday_ck CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT programacao_blocos_fim_ck CHECK (fim IS NULL OR fim > inicio),
  CONSTRAINT programacao_blocos_regra_ck CHECK (regra IN ('todos','ninguem','area','grupo','pessoas','livro')),
  CONSTRAINT programacao_blocos_livro_show_ck CHECK (regra <> 'livro' OR show_book_id IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS programacao_blocos_programacao_weekday_idx ON programacao_blocos (programacao_id, weekday);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS escala_areas_prontas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scales(id),
  area_id uuid NOT NULL REFERENCES areas(id),
  marked_by uuid NOT NULL REFERENCES users(id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  unmarked_by uuid REFERENCES users(id),
  unmarked_at timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS escala_areas_prontas_active_uq ON escala_areas_prontas (scale_id, area_id) WHERE active;