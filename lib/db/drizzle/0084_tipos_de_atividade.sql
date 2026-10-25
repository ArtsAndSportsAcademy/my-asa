-- Tipos de atividade por local (25/10/2026). A planilha de papel pinta cada atividade pela cor do tipo (treino no gelo, ensaio, show…); a
-- Escala já fazia isso adivinhando pelo nome da atividade. Agora cada local tem a sua lista de tipos, que só a Administração mexe, e a
-- Programação e a atividade só de hoje podem escolher o tipo de verdade. Sem escolha, o app continua adivinhando pelo nome.
--   chave = de qual dos sete tipos prontos o tipo nasceu (serve ao palpite pelo nome, mesmo depois de renomeado);
--   cor   = uma das 15 cores da lista fixa (cada uma com contraste de leitura; o nome do tipo vem sempre escrito);
--   tipo nunca é apagado: arquivar (active = false) só o tira da lista de escolha, e dá para desarquivar.
-- Aditivo: uma tabela nova, duas colunas novas (vazias) e os sete tipos prontos para cada local que já existe. Nada que existe é tocado.
CREATE TABLE escala_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  nome text NOT NULL,
  cor text NOT NULL,
  chave text,
  ordem integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escala_tipos_cor_ck CHECK (cor IN ('gelo','ensaio','show','inter','prod','pausa','outra','coral','magenta','oliva','marrom','lima','grafite','dourado','rubi'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX escala_tipos_local_chave_uq ON escala_tipos (location_id, chave) WHERE chave IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX escala_tipos_local_nome_uq ON escala_tipos (location_id, lower(nome)) WHERE active;
--> statement-breakpoint
ALTER TABLE escala_tipos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE programacao_blocos ADD COLUMN tipo_id uuid REFERENCES escala_tipos(id);
--> statement-breakpoint
ALTER TABLE scale_allocations ADD COLUMN tipo_id uuid REFERENCES escala_tipos(id);
--> statement-breakpoint
INSERT INTO escala_tipos (organization_id, location_id, nome, cor, chave, ordem)
SELECT l.organization_id, l.id, t.nome, t.chave, t.chave, t.ordem
FROM locations l
CROSS JOIN (VALUES
  ('gelo',   'Treinos no gelo',          1),
  ('ensaio', 'Ensaios e preparação',     2),
  ('show',   'Shows e teatro',           3),
  ('inter',  'Interações e personagens', 4),
  ('prod',   'Produção e apoio',         5),
  ('pausa',  'Pausas e almoço',          6),
  ('outra',  'Outras atividades',        7)
) AS t(chave, nome, ordem);
