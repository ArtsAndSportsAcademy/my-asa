-- Desfaz a equipe por local (pacote O).
-- O que se perde: a equipe marcada em cada Programação, os imprevistos do dia ("trazer para cá hoje") e os tempos de deslocamento entre locais.
-- A Programação, a Escala e o Livro do Dia em si nunca foram tocados por esta migração: voltam a valer sem filtro de local, como antes.
-- Os eventos do Registro continuam onde estão. Se for preciso guardar a equipe antes, faça o backup (lib/db/scripts/backup-producao.ts).
-- Rode ANTES de voltar o código para uma versão que não conhece as tabelas.
DROP TABLE IF EXISTS locais_deslocamento;
DROP TABLE IF EXISTS escala_local_do_dia;
DROP TABLE IF EXISTS programacao_equipe;
