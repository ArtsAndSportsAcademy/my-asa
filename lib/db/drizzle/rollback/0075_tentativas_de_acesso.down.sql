-- Desfaz o limite de tentativas de senha.
-- O que se perde: a contagem de erros e os bloqueios em andamento (quem estava pausado volta a poder tentar na hora).
-- Nenhuma senha, pessoa ou histórico é tocado. Rode ANTES de voltar o código para uma versão sem o limite, ou o código novo
-- falha ao ler a tabela.
DROP TABLE IF EXISTS tentativas_de_acesso;
