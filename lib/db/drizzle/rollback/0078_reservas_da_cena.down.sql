-- Desfaz as reservas da cena.
-- O que se perde: as listas de reservas montadas nas cenas. Os titulares e os substitutos de cada bolinha não são tocados.
-- Depois disso, uma posição cujo titular não pode e que não tem substituto próprio volta a ficar descoberta no Livro do Dia.
-- Rode ANTES de voltar o código para uma versão sem as reservas, ou a leitura das cenas falha na coluna.
ALTER TABLE show_book_scenes DROP COLUMN IF EXISTS reserve_ids;
