-- Grupos de folga (13/10): na alta temporada as duas folgas da semana são fixas por grupo (regra da
-- Babi). O grupo guarda só o padrão — as pessoas e os dois dias de folga —, não um período: os
-- grupos mudam a cada ano (dependem de quem faz o quê no show), então nada de molde permanente.
-- Aplicar um grupo é marcar aquela folga no período escolhido, pelo mesmo caminho do "Definir folga".
-- É por equipe: cada supervisor cuida do grupo da sua equipe; a Administração vê e edita todos.
CREATE TABLE folga_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES operations(id),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  dias_folga integer[] NOT NULL DEFAULT '{}'::integer[],
  pessoa_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  tipo folga_type NOT NULL DEFAULT 'DAY_OFF',
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folga_grupos_dias_ck CHECK (dias_folga <@ ARRAY[0,1,2,3,4,5,6])
);
--> statement-breakpoint
ALTER TABLE folga_grupos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE folga_grupos FROM anon, authenticated, PUBLIC;
CREATE INDEX folga_grupos_operation_idx ON folga_grupos(operation_id) WHERE active;
