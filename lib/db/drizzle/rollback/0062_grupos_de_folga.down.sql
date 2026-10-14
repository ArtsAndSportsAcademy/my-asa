-- Desfaz a criação dos grupos de folga. As folgas já aplicadas por um grupo são folgas comuns na
-- tabela folgas e NÃO são tocadas aqui — some só a configuração salva do grupo.
DROP TABLE IF EXISTS folga_grupos;
