-- Desfaz o vigia do relógio do sistema.
-- O que se perde: o instante do último ciclo e a marca de "parada já avisada". Nenhuma pessoa, escala, aviso ou Registro é tocado
-- (os avisos e eventos do Registro que o vigia já gravou continuam onde estão). Rode ANTES de voltar o código para uma versão sem o
-- vigia, ou o código novo falha ao ler a tabela (o ciclo em si continua, pois o vigia nunca derruba o ciclo).
DROP TABLE IF EXISTS relogio_do_sistema;
