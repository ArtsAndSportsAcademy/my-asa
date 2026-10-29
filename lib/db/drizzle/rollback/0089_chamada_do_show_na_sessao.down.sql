-- Desfaz a 0089 (chamada de bloco de show na sessão do show).
-- Não há o que desfazer no banco: a migração só COPIOU chamadas para as sessões e deixou as originais nos blocos, sem tocar nelas.
-- Voltando o código antigo, os blocos de show voltam a ler as próprias chamadas; as cópias nas sessões continuam valendo na tela do show
-- (e podem ser tiradas por lá, que não apaga: marca como inativa).
SELECT 1;
