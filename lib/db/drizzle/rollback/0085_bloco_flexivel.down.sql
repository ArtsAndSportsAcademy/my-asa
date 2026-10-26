-- Desfaz o bloco flexível.
-- O que se perde: a marca "flexível" de cada bloco da Programação. Os blocos voltam a ser horários fixos e passam a gerar choque de novo
-- com o que cruzar. Os eventos do Registro continuam onde estão.
-- Rode ANTES de voltar o código para uma versão que não conhece a coluna.
ALTER TABLE programacao_blocos DROP COLUMN IF EXISTS flexivel;
