-- Personagens e vagas por show (06/10).
-- characters.show_book_id: vaga que só existe naquele show (P1, Boas vindas 1…). NULL = personagem
-- compartilhado entre shows do local (Astrid, Rainha), que é o que aparece na aba Personagens.
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "show_book_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_show_book_id_fk";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_show_book_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "show_books"("id");--> statement-breakpoint
-- O nome deixa de ser único no local inteiro: P1 do Teatro e P1 de outro show convivem.
-- Continua único entre os ativos do mesmo local e do mesmo show (ou entre os compartilhados).
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_name_location_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "characters_name_location_show_uq" ON "characters" ("location_id", "name", COALESCE("show_book_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "active";--> statement-breakpoint
-- Cena reservada que guarda as vagas de personagem do show inteiro. Não aparece na estrutura
-- escrita do Livro oficial; é ela que o Livro do Dia lê para escalar quem faz cada personagem.
ALTER TABLE "show_book_scenes" ADD COLUMN IF NOT EXISTS "is_cast_roster" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "show_book_scenes_one_cast_roster_uq" ON "show_book_scenes" ("show_book_id") WHERE "is_cast_roster" AND "active";
