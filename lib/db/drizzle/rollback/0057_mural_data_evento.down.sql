-- Desfaz 0057. A data do evento dos avisos se perde; o aviso continua.
ALTER TABLE "announcements" DROP COLUMN IF EXISTS "event_date";
