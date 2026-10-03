-- Mural (02/10): aviso para pessoas escolhidas, além de toda a casa, uma área ou um local.
-- Quem recebe fica em announcement_recipients; quem publicou sempre vê o próprio aviso.
ALTER TYPE "public"."announcement_scope" ADD VALUE IF NOT EXISTS 'PEOPLE';--> statement-breakpoint
-- O destino PEOPLE não tem área nem local. Compara como texto: o valor novo do tipo ainda não
-- pode ser usado como literal na mesma transação.
ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "announcements_scope_target_ck";--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_scope_target_ck" CHECK (
  (scope::text = 'HOUSE' AND area_id IS NULL AND location_id IS NULL) OR
  (scope::text = 'AREA' AND area_id IS NOT NULL) OR
  (scope::text = 'LOCATION' AND location_id IS NOT NULL) OR
  (scope::text = 'PEOPLE' AND area_id IS NULL AND location_id IS NULL)
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcement_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "announcement_id" uuid NOT NULL REFERENCES "announcements"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "announcement_recipients_announcement_user_uq" UNIQUE ("announcement_id", "user_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_recipients_user_idx" ON "announcement_recipients" ("user_id");--> statement-breakpoint
-- Como toda tabela pública: só a API (papel do servidor) lê e escreve.
ALTER TABLE "announcement_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "announcement_recipients" FROM anon, authenticated, PUBLIC;
