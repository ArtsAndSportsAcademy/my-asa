-- Horário de show por dia da semana (06/10): o Goodbye é 15:30 em uns dias e 15:45 em outros.
-- weekdays = lista de 0 (domingo) a 6 (sábado); NULL = vale todos os dias (como antes).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "weekdays" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_weekdays_ck";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_weekdays_ck" CHECK ("weekdays" IS NULL OR (jsonb_typeof("weekdays") = 'array' AND jsonb_array_length("weekdays") > 0));
