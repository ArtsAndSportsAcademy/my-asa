-- Desfaz as pastas dos shows.
-- O que se perde: o nome da pasta de cada show (a coluna folder é apagada). Os shows em si não mudam; voltam todos para a lista única do local.
-- Os eventos do Registro ("Show movido de pasta") continuam onde estão. Rode ANTES de voltar o código para uma versão sem pastas.
ALTER TABLE show_books DROP COLUMN folder;
