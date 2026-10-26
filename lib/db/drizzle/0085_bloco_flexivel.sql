-- Bloco flexível (26/10/2026). O almoço do papel é "11:00–13:00, cada um almoça quando dá": uma janela, não um horário fixo. Como bloco comum
-- de 11h às 13h ele cruzava com tudo e a Escala acusava 20 choques que não existiam. A Programação ganha o indicador "flexível": o bloco
-- vira uma linha só, sem nomes de pessoas e sem choque; a pessoa cumpre dentro da janela. Vale para qualquer bloco, não só almoço.
-- Aditivo: uma coluna nova, falsa para todos os blocos que já existem. Nada que existe muda de comportamento até alguém marcar.
ALTER TABLE programacao_blocos ADD COLUMN flexivel boolean NOT NULL DEFAULT false;
