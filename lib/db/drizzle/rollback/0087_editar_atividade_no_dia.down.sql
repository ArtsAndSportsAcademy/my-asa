-- Desfaz a edição de atividade só no dia.
-- O que se perde: todas as edições feitas (nome, horário e tipo mudados só numa data). A Escala daquelas datas volta a mostrar o que a
-- Programação manda. A Programação em si nunca foi tocada. Os eventos do Registro continuam onde estão.
-- Rode ANTES de voltar o código para uma versão que não conhece a tabela.
DROP TABLE IF EXISTS escala_bloco_edicoes;
