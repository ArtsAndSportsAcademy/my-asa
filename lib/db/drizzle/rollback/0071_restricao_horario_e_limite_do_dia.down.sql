-- Desfaz a restrição de horário, o limite de shows por dia e a sessão separada.
-- O que se perde: as restrições de horário e as regras por local cadastradas; as sessões voltam a "não
-- separada" e os Livros do Dia de sessão separada perdem o vínculo com a sessão (continuam existindo, mas
-- voltam a valer como Livros comuns do show na data — confira se ficou algum duplicado antes de desfazer).
DROP INDEX IF EXISTS daily_books_session_dia_uq;
ALTER TABLE daily_books DROP COLUMN IF EXISTS session_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS separada;
DROP TABLE IF EXISTS escala_regras_local;
DROP TABLE IF EXISTS restricoes_horario;
