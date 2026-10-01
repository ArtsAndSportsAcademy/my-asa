-- Agendador do My ASA em produção (Supabase em São Paulo + API na Vercel).
-- Rode no SQL Editor do projeto do Supabase DEPOIS que a API estiver no ar na Vercel.
-- Troque os dois valores marcados com <<< >>> antes de rodar.
--
-- Por quê: na Vercel o servidor só acorda quando alguém usa o app. Avisos na fila, lembrete de
-- check-in, publicação automática da escala e conferência de presença precisam rodar sozinhos.
-- O pg_cron do Supabase chama a API a cada minuto; a API só aceita a chamada com a chave
-- CRON_SECRET (a mesma configurada na Vercel), no cabeçalho x-myasa-cron.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Endereço da API e chave do agendador, guardados no cofre do Supabase (não ficam em texto
--    na definição do agendamento).
select vault.create_secret('<<<https://ENDERECO-DA-API.vercel.app>>>', 'myasa_api_url', 'Endereço da API do My ASA');
select vault.create_secret('<<<MESMO-VALOR-DE-CRON_SECRET-DA-VERCEL>>>', 'myasa_cron_secret', 'Chave do agendador do My ASA');

-- 2) Ciclo operacional a cada minuto: avisos da fila, lembretes, publicação automática, presença.
select cron.schedule(
  'myasa-ciclo',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'myasa_api_url') || '/api/internal/ciclo',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-myasa-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'myasa_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- 3) Lembrete diário de tarefas às 08:00 de São Paulo (11:00 UTC; o Brasil não tem horário de verão).
select cron.schedule(
  'myasa-tarefas-do-dia',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'myasa_api_url') || '/api/internal/tarefas-do-dia',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-myasa-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'myasa_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Conferir depois de uns minutos:
--   select jobname, schedule, active from cron.job;
--   select status_code, content::text, created from net._http_response order by created desc limit 5;
-- Esperado: status 200 e {"ok":true,...}. 401 = chave diferente da Vercel; 503 = CRON_SECRET não configurada na Vercel.
--
-- Para parar: select cron.unschedule('myasa-ciclo'); select cron.unschedule('myasa-tarefas-do-dia');
