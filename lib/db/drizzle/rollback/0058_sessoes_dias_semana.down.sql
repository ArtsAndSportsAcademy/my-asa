-- Desfaz 0058. Os dias da semana de cada horário se perdem: todos os horários voltam a valer todos os dias.
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_weekdays_ck";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "weekdays";
