-- Desfaz os limites de folga por dia e o lembrete. Os valores salvos nestas colunas se perdem; o app volta
-- ao comportamento anterior (limite por área só avisando, sem limite total e sem lembrete).
ALTER TABLE folga_config
  DROP COLUMN IF EXISTS limite_total_ativo,
  DROP COLUMN IF EXISTS limite_total,
  DROP COLUMN IF EXISTS limite_total_modo,
  DROP COLUMN IF EXISTS limite_area_ativo,
  DROP COLUMN IF EXISTS limite_area_modo,
  DROP COLUMN IF EXISTS lembrete_resposta_horas;
