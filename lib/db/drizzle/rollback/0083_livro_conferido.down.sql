-- Desfaz o "Conferido" no Livro do Dia.
-- O que se perde: quem conferiu cada Livro, quando, e o retrato do elenco. Todo Livro volta a "falta conferir". Os eventos do Registro
-- ("Livro do Dia conferido") continuam onde estão. Rode ANTES de voltar o código para uma versão que não conhece essas colunas.
ALTER TABLE daily_books DROP COLUMN IF EXISTS conferred_fingerprint;
--> statement-breakpoint
ALTER TABLE daily_books DROP COLUMN IF EXISTS conferred_at;
--> statement-breakpoint
ALTER TABLE daily_books DROP COLUMN IF EXISTS conferred_by;
