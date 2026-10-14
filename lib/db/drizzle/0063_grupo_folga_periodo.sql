-- Grupo de folga por período corrido (13/10): além do modo "por dia da semana" (folgas fixas), um
-- grupo pode ser um intervalo de datas — como o recesso, que vai de tal a tal data, não por dia da
-- semana. Nulo nas colunas = o grupo é por dia da semana (diasFolga). Exatamente um modo vale, o que
-- a API garante; aqui só travamos que a data final não seja antes da inicial.
ALTER TABLE folga_grupos ADD COLUMN IF NOT EXISTS data_inicio date;--> statement-breakpoint
ALTER TABLE folga_grupos ADD COLUMN IF NOT EXISTS data_fim date;--> statement-breakpoint
ALTER TABLE folga_grupos DROP CONSTRAINT IF EXISTS folga_grupos_periodo_ck;--> statement-breakpoint
ALTER TABLE folga_grupos ADD CONSTRAINT folga_grupos_periodo_ck CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio);
