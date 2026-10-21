-- Vigia do relógio do sistema (21/10/2026). O ciclo por minuto (POST /api/internal/ciclo, chamado pelo pg_cron do Supabase) cuida de
-- check-ins, lembretes e avisos, mas não guardava quando rodou pela última vez: se parasse, ninguém ficava sabendo até alguém reclamar.
-- Aditivo: uma tabela nova, com uma linha por relógio (hoje só 'ciclo'), criada pelo primeiro ciclo que rodar. Nada que existe é tocado.
--   ultimo_inicio_em  = quando o último ciclo começou;  ultimo_sucesso_em = quando o último terminou bem;
--   ultimo_erro_em    = quando o último falhou;         parado_desde       = preenchido enquanto há uma parada já avisada
--                       (é o que garante UM aviso por parada, e não um por minuto).
CREATE TABLE relogio_do_sistema (
  chave text PRIMARY KEY,
  ultimo_inicio_em timestamptz,
  ultimo_sucesso_em timestamptz,
  ultimo_erro_em timestamptz,
  parado_desde timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE relogio_do_sistema ENABLE ROW LEVEL SECURITY;
