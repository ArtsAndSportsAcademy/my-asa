-- "Conferido" no Livro do Dia (25/10/2026). Quem é responsável pelo show confere quem faz cada papel e marca o Livro como conferido;
-- a Escala mostra isso num cartão por show. A marca guarda quem conferiu, quando, e um retrato do elenco do Livro naquela hora: se outra
-- pessoa mudar quem faz o quê, o retrato deixa de bater e o Livro volta a "falta conferir" sozinho. Se quem mexeu foi a própria pessoa que
-- conferiu, a API atualiza o retrato e a marca continua.
-- Aditivo: três colunas novas, sem valor padrão obrigatório. Nada que existe é tocado; Livro antigo nasce "sem conferência".
ALTER TABLE daily_books ADD COLUMN conferred_by uuid REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE daily_books ADD COLUMN conferred_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE daily_books ADD COLUMN conferred_fingerprint text;
