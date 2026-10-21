-- Limpa do registro da ASA (asa_audit_log) o TEXTO das mensagens que a ASA mostrou a alguém.
--
-- Por quê: quando a pessoa pergunta à ASA "minhas mensagens", a resposta traz o texto das conversas dela. Até 21/10/2026 essa
-- resposta ficava gravada no registro da casa, e a Administração e a Supervisão podiam lê-la (a Administração não lê conversa).
-- O código novo já não grava esse texto e a leitura já o esconde; este script apaga o que ficou gravado antes.
--
-- Quem roda: quem constrói o app, em produção. O assistente só roda no banco de TESTE.
-- Não é migração: não mexe no desenho do banco e não entra no _journal.json.
-- Não tem volta (o texto antigo some de verdade). Se quiser segurança, tire um backup do banco antes.
--
-- Como rodar: primeiro o PASSO 1 sozinho (só conta). Se o número fizer sentido, rode o PASSO 2.

-- PASSO 1 — conferir quantas linhas serão limpas (não altera nada)
SELECT count(*) AS linhas_com_texto
FROM asa_audit_log
WHERE tools_used ? 'consultar_mensagens'
  AND response <> 'O conteúdo de conversas não aparece no registro da ASA.';

-- PASSO 2 — limpar (tudo ou nada: se algo falhar, nada muda)
BEGIN;

UPDATE asa_audit_log
SET response = 'O conteúdo de conversas não aparece no registro da ASA.'
WHERE tools_used ? 'consultar_mensagens'
  AND response <> 'O conteúdo de conversas não aparece no registro da ASA.';

COMMIT;
