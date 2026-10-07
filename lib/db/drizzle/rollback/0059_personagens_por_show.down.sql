-- Desfaz 0059. As vagas exclusivas viram personagens comuns do local; se houver dois ativos com o
-- mesmo nome no mesmo local, a restrição antiga não volta e é preciso renomear um deles antes.
DROP INDEX IF EXISTS "show_book_scenes_one_cast_roster_uq";
ALTER TABLE "show_book_scenes" DROP COLUMN IF EXISTS "is_cast_roster";
DROP INDEX IF EXISTS "characters_name_location_show_uq";
ALTER TABLE "characters" ADD CONSTRAINT "characters_name_location_uq" UNIQUE ("name", "location_id");
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_show_book_id_fk";
ALTER TABLE "characters" DROP COLUMN IF EXISTS "show_book_id";
