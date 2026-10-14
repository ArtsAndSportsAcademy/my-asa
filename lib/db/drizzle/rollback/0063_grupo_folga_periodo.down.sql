-- Volta o grupo de folga a ser só por dia da semana. Grupos que eram por período perdem o intervalo.
ALTER TABLE folga_grupos DROP CONSTRAINT IF EXISTS folga_grupos_periodo_ck;
ALTER TABLE folga_grupos DROP COLUMN IF EXISTS data_fim;
ALTER TABLE folga_grupos DROP COLUMN IF EXISTS data_inicio;
