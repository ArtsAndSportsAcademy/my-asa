-- Formato do palco no show (17/10/2026). O mapa do palco, os quadros-chave e as formações do Livro do Dia só aparecem
-- quando o show tem um formato; até hoje esse dado não existia em lugar nenhum e todo show real caía em "sem mapa".
-- O formato é do show inteiro: L, RET (retangular), QUAD (quadrado) ou NONE (sem mapa). Aditivo: todo show que já existe
-- fica em NONE, então nenhuma tela muda sozinha.
ALTER TABLE show_books
  ADD COLUMN stage_format text NOT NULL DEFAULT 'NONE',
  ADD CONSTRAINT show_books_stage_format_ck CHECK (stage_format IN ('L', 'RET', 'QUAD', 'NONE'));
