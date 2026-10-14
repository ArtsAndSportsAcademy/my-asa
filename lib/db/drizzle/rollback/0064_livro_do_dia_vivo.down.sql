-- Desfaz o Livro do Dia vivo. As vagas guardadas (userId/status) não mudam — só a coluna some.
ALTER TABLE daily_book_assignments DROP COLUMN IF EXISTS manual;
