-- Desfaz o "tempo disponível" da Escala do dia.
-- O que se perde: o liga/desliga e os minutos escolhidos por cada local. O aviso deixa de existir (o código antigo não o conhece). Os eventos do
-- Registro ("Tempo disponível alterado") continuam onde estão. Rode ANTES de voltar o código para uma versão que não conhece essas colunas.
ALTER TABLE locations DROP COLUMN IF EXISTS tempo_disponivel_minutos;
--> statement-breakpoint
ALTER TABLE locations DROP COLUMN IF EXISTS tempo_disponivel_ligado;
