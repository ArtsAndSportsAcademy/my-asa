-- Desfaz o formato do palco no show.
-- O que se perde: o formato escolhido em cada show (volta tudo a "sem mapa"). Os quadros-chave e as zonas gravados
-- continuam existindo; só deixam de aparecer na tela, como antes.
ALTER TABLE show_books DROP CONSTRAINT IF EXISTS show_books_stage_format_ck;
ALTER TABLE show_books DROP COLUMN IF EXISTS stage_format;
