-- Editar uma atividade só neste dia (27/10/2026). Até aqui, o que a Escala do dia guardava por cima da Programação era "tirar/pôr uma pessoa" e
-- "horário só de uma pessoa". Faltava mudar a ATIVIDADE inteira só naquela data: o horário para todo mundo, o nome, o tipo/cor. Esta tabela guarda
-- essa edição: uma por atividade do dia (chave do bloco, como em escala_bloco_ajustes) e só vale na Escala daquela data. A Programação não muda.
--   Só se guarda o que foi mudado: coluna vazia = "vale o que a Programação manda". Remoção é lógica (active = false): "Voltar ao normal".
-- Aditivo: uma tabela nova. Nada que existe é tocado.
CREATE TABLE escala_bloco_edicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scales(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  novo_rotulo text,
  novo_inicio text,
  novo_fim text,
  novo_tipo_id uuid REFERENCES escala_tipos(id),
  motivo text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid REFERENCES users(id),
  ended_at timestamptz,
  CONSTRAINT escala_bloco_edicoes_algo_ck CHECK (novo_rotulo IS NOT NULL OR novo_inicio IS NOT NULL OR novo_fim IS NOT NULL OR novo_tipo_id IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX escala_bloco_edicoes_active_uq ON escala_bloco_edicoes (scale_id, source_key) WHERE active;
--> statement-breakpoint
CREATE INDEX escala_bloco_edicoes_scale_idx ON escala_bloco_edicoes (scale_id);
--> statement-breakpoint
ALTER TABLE escala_bloco_edicoes ENABLE ROW LEVEL SECURITY;
