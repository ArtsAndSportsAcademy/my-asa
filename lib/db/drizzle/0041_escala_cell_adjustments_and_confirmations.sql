-- 15 Escalas: exceções de célula por dia e confirmação de leitura do Elenco.
-- A Programação e o Livro do Dia continuam as fontes; estes registros apenas aplicam uma
-- inclusão/remoção explícita numa célula da Escala daquele dia.
CREATE TABLE IF NOT EXISTS escala_bloco_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scales(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid REFERENCES users(id),
  ended_at timestamptz,
  CONSTRAINT escala_bloco_ajustes_action_ck CHECK (action IN ('ADICIONAR','REMOVER'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS escala_bloco_ajustes_active_uq
  ON escala_bloco_ajustes (scale_id, source_key, user_id) WHERE active;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS escala_bloco_ajustes_scale_source_idx
  ON escala_bloco_ajustes (scale_id, source_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS escala_confirmacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS escala_confirmacoes_scale_user_uq ON escala_confirmacoes (scale_id, user_id);
--> statement-breakpoint
ALTER TABLE public.escala_bloco_ajustes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.escala_confirmacoes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.escala_bloco_ajustes, public.escala_confirmacoes FROM PUBLIC, anon, authenticated;
