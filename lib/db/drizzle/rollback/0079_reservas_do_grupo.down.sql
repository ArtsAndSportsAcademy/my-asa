-- Desfaz as reservas do grupo.
-- O que se perde: as listas de reservas montadas nos grupos. Titulares e substitutos de cada bolinha não são tocados.
-- Depois disso, o código que lê as reservas do grupo falha na coluna: rode ANTES de voltar o código para a versão da 0078.
ALTER TABLE show_book_blocks DROP COLUMN IF EXISTS reserve_ids;
