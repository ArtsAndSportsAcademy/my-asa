-- Limpa do Registro o TEXTO das mensagens enviadas antes de 14/10/2026.
--
-- Por quê: a Administração não lê conversa de ninguém (decisão de 14/10/2026). As primeiras linhas do Registro
-- guardaram o texto escrito; hoje a tela só o esconde na leitura (routes/history.ts), mas ele continua gravado no
-- banco. Este script troca o texto por uma frase neutra e mantém quem enviou, onde e quando.
--
-- Quem roda: a Babi, em produção. O assistente só roda no banco de TESTE.
-- Não é migração: não mexe no desenho do banco e não entra no _journal.json.
-- Não tem volta (o texto antigo some de verdade). Se quiser segurança, tire um backup do banco antes.
--
-- Como rodar: primeiro o PASSO 1 sozinho (só conta). Se o número fizer sentido, rode o PASSO 2.

-- PASSO 1 — conferir quantas linhas serão limpas (não altera nada)
SELECT count(*) AS linhas_com_texto
FROM history_events
WHERE entity_type = 'message'
  AND (
    narrative IS DISTINCT FROM 'Mensagem enviada.'
    AND narrative NOT LIKE '% enviou uma mensagem.'
    AND narrative NOT LIKE '% enviou uma figurinha.'
    AND narrative NOT LIKE 'Alguém enviou %'
  );

-- PASSO 2 — limpar (tudo ou nada: se algo falhar, nada muda)
BEGIN;

UPDATE history_events
SET narrative    = 'Mensagem enviada.',
    before_state = NULL,
    after_state  = CASE
                     WHEN after_state IS NULL THEN NULL
                     ELSE jsonb_strip_nulls(jsonb_build_object(
                            'id',       after_state -> 'id',
                            'threadId', after_state -> 'threadId',
                            'kind',     after_state -> 'kind'))
                   END
WHERE entity_type = 'message'
  AND (
    narrative IS DISTINCT FROM 'Mensagem enviada.'
    AND narrative NOT LIKE '% enviou uma mensagem.'
    AND narrative NOT LIKE '% enviou uma figurinha.'
    AND narrative NOT LIKE 'Alguém enviou %'
  );

-- Conferência: a contagem do PASSO 1 agora tem que dar 0.
SELECT count(*) AS linhas_com_texto_depois
FROM history_events
WHERE entity_type = 'message'
  AND (
    narrative IS DISTINCT FROM 'Mensagem enviada.'
    AND narrative NOT LIKE '% enviou uma mensagem.'
    AND narrative NOT LIKE '% enviou uma figurinha.'
    AND narrative NOT LIKE 'Alguém enviou %'
  );

COMMIT;
