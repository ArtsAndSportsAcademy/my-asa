-- Livro do Dia vivo (14/10): a vaga sem `manual=true` passa a ser recalculada na leitura, com o
-- mesmo motor que gera o livro. `manual=true` é a exceção do dia — a gerência trocou esta vaga à
-- mão, e ela para de ser recalculada sozinha. Todas as vagas já existentes nascem `false` (vagas
-- geradas até hoje continuam vivas, como se tivessem acabado de ser geradas).
ALTER TABLE daily_book_assignments ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;
