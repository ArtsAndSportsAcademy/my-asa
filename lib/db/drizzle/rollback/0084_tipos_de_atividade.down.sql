-- Desfaz os tipos de atividade por local.
-- O que se perde: a lista de tipos de cada local (nomes e cores escolhidos) e o tipo escolhido em cada bloco da Programação e em cada atividade
-- só de hoje. A Escala volta a adivinhar o tipo pelo nome da atividade, como fazia antes. Os eventos do Registro continuam onde estão.
-- Rode ANTES de voltar o código para uma versão que não conhece essas colunas.
ALTER TABLE scale_allocations DROP COLUMN IF EXISTS tipo_id;
--> statement-breakpoint
ALTER TABLE programacao_blocos DROP COLUMN IF EXISTS tipo_id;
--> statement-breakpoint
DROP TABLE IF EXISTS escala_tipos;
