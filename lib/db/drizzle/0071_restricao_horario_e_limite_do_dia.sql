-- Restrição de horário por pessoa, limite de shows por dia e sessão separada (16/10/2026). Tudo aditivo.
--   * restricoes_horario: "a pessoa só pode trabalhar das X às Y, nestes dias da semana, neste período"
--     (ex.: escola). É proibição no motor do Livro do Dia; a exceção é a mexida à mão, com motivo escrito.
--   * escala_regras_local: por local, o máximo de shows que uma pessoa faz por dia (null = sem limite) e o
--     intervalo mínimo, em minutos, abaixo do qual dois shows do mesmo dia contam como "colados".
--   * sessions.separada: a sessão tem Livro do Dia próprio, com as próprias pessoas. Padrão false = como hoje.
--   * daily_books.session_id: o Livro de uma sessão separada aponta para a sessão; nulo é o Livro do dia do show.
CREATE TABLE restricoes_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  dias_semana integer[] NOT NULL CHECK (cardinality(dias_semana) > 0 AND dias_semana <@ ARRAY[0,1,2,3,4,5,6]),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  period_start date NOT NULL,
  period_end date,
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid REFERENCES users(id),
  ended_at timestamptz,
  CONSTRAINT restricoes_horario_fim_depois_inicio_ck CHECK (hora_fim > hora_inicio),
  CONSTRAINT restricoes_horario_periodo_ck CHECK (period_end IS NULL OR period_end >= period_start)
);
--> statement-breakpoint
CREATE INDEX restricoes_horario_user_ativa_idx ON restricoes_horario (user_id) WHERE status = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE restricoes_horario ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE restricoes_horario FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
CREATE TABLE escala_regras_local (
  location_id uuid PRIMARY KEY REFERENCES locations(id),
  limite_shows_dia integer CHECK (limite_shows_dia IS NULL OR limite_shows_dia BETWEEN 1 AND 20),
  intervalo_minimo_minutos integer NOT NULL DEFAULT 20 CHECK (intervalo_minimo_minutos BETWEEN 0 AND 240),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE escala_regras_local ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE escala_regras_local FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN separada boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE daily_books ADD COLUMN session_id uuid REFERENCES sessions(id);
--> statement-breakpoint
CREATE UNIQUE INDEX daily_books_session_dia_uq ON daily_books (agenda_event_id, session_id)
  WHERE session_id IS NOT NULL AND status <> 'CANCELLED';
