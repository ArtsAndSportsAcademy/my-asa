-- Desfaz o "qual dia a Escala mostra ao abrir".
-- O que se perde: as duas horas escolhidas por cada local. A Escala volta a abrir sempre em amanhã para quem prepara o dia (a regra
-- antiga, fixa no código). Os eventos do Registro ("Dia que a Escala abre alterado") continuam onde estão. Rode ANTES de voltar o código
-- para uma versão que não conhece essas colunas.
ALTER TABLE locations DROP COLUMN IF EXISTS escala_volta_a_hoje_a_partir;
--> statement-breakpoint
ALTER TABLE locations DROP COLUMN IF EXISTS escala_abre_amanha_a_partir;
