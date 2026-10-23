-- Reservas do grupo (23/10/2026). A primeira versão das reservas (0078) era por CENA, mas a mesma cena pode ter um grupo de
-- patinadores e um de bailarinos, e um bailarino não substitui um patinador. A lista passa a ser de cada GRUPO (bloco) da cena.
-- Aditivo: uma coluna nova, vazia para todos os grupos. A coluna por cena (0078) fica onde está, sem uso e sem ser apagada;
-- o Livro do Dia só lê a lista do grupo.
ALTER TABLE show_book_blocks ADD COLUMN reserve_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
