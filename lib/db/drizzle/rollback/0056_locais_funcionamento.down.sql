-- Desfaz 0056 (funcionamento dos Locais). Os dias e horários de funcionamento cadastrados se perdem.
ALTER TABLE "locations" DROP COLUMN IF EXISTS "close_time";
ALTER TABLE "locations" DROP COLUMN IF EXISTS "open_time";
ALTER TABLE "locations" DROP COLUMN IF EXISTS "operating_days";
