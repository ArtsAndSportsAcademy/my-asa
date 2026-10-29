-- Equipe por local na Programação (pacote O, 28/10/2026). Até aqui o app não sabia em que local cada pessoa trabalha: "todo mundo" era o elenco
-- inteiro e "Bailarinos" eram todos os bailarinos, de qualquer local. Três tabelas novas resolvem isso, sem tocar em nada que já existe:
--
--   programacao_equipe   a equipe de uma Programação (temporada de um local): quem trabalha ali, em que dia da semana e, se quiser, de que hora a que hora.
--                        Horário vazio = o dia inteiro. A mesma pessoa pode ter mais de uma linha no mesmo dia (ex.: até 13:00 num local, e noutro a partir das 14:00).
--   escala_local_do_dia  o imprevisto de UM dia: "trazer o Fulano para cá hoje" / "mandar para a Acqua hoje". Vale só naquela data e, se quiser, só num trecho
--                        do dia ("a partir de" / "até"). Não mexe na Programação.
--   locais_deslocamento  quantos minutos leva de um local ao outro. Um par guarda uma linha só (Snowland ↔ Acqua é o mesmo que Acqua ↔ Snowland): o
--                        menor id fica em location_a_id. Par sem linha = só se confere se os horários se cruzam.
--
-- Remoção é sempre lógica (active = false), nunca DELETE: dá para trazer de volta e o Registro continua fazendo sentido.
-- Aditivo: três tabelas novas e nenhuma coluna mexida. Nada é lido por código antigo, então é seguro aplicar antes da API.
CREATE TABLE programacao_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES programacoes(id),
  user_id uuid NOT NULL REFERENCES users(id),
  -- 0 = domingo … 6 = sábado (igual a programacao_blocos)
  weekday integer NOT NULL,
  inicio time,
  fim time,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programacao_equipe_weekday_ck CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT programacao_equipe_fim_ck CHECK (inicio IS NULL OR fim IS NULL OR fim > inicio)
);
--> statement-breakpoint
-- Não repete a mesma pessoa, no mesmo dia e na mesma janela (janela vazia conta como o dia inteiro).
CREATE UNIQUE INDEX programacao_equipe_active_uq ON programacao_equipe (programacao_id, user_id, weekday, coalesce(inicio, time '00:00'), coalesce(fim, time '24:00')) WHERE active;
--> statement-breakpoint
CREATE INDEX programacao_equipe_programacao_weekday_idx ON programacao_equipe (programacao_id, weekday) WHERE active;
--> statement-breakpoint
CREATE INDEX programacao_equipe_user_idx ON programacao_equipe (user_id) WHERE active;
--> statement-breakpoint
ALTER TABLE programacao_equipe ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE escala_local_do_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  data date NOT NULL,
  -- O local onde a pessoa trabalha NAQUELE dia (o de destino do imprevisto).
  location_id uuid NOT NULL REFERENCES locations(id),
  inicio time,
  fim time,
  motivo text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid REFERENCES users(id),
  ended_at timestamptz,
  CONSTRAINT escala_local_do_dia_fim_ck CHECK (inicio IS NULL OR fim IS NULL OR fim > inicio)
);
--> statement-breakpoint
CREATE UNIQUE INDEX escala_local_do_dia_active_uq ON escala_local_do_dia (user_id, data, location_id, coalesce(inicio, time '00:00'), coalesce(fim, time '24:00')) WHERE active;
--> statement-breakpoint
CREATE INDEX escala_local_do_dia_local_data_idx ON escala_local_do_dia (location_id, data) WHERE active;
--> statement-breakpoint
CREATE INDEX escala_local_do_dia_user_data_idx ON escala_local_do_dia (user_id, data) WHERE active;
--> statement-breakpoint
ALTER TABLE escala_local_do_dia ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE locais_deslocamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_a_id uuid NOT NULL REFERENCES locations(id),
  location_b_id uuid NOT NULL REFERENCES locations(id),
  minutos integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locais_deslocamento_ordem_ck CHECK (location_a_id < location_b_id),
  CONSTRAINT locais_deslocamento_minutos_ck CHECK (minutos BETWEEN 0 AND 720)
);
--> statement-breakpoint
CREATE UNIQUE INDEX locais_deslocamento_active_uq ON locais_deslocamento (location_a_id, location_b_id) WHERE active;
--> statement-breakpoint
ALTER TABLE locais_deslocamento ENABLE ROW LEVEL SECURITY;
