ALTER TABLE "message_threads" ADD COLUMN IF NOT EXISTS "group_id" uuid;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "quoted_message_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_messages_id_fk" FOREIGN KEY ("quoted_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_thread_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL REFERENCES "public"."message_threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE, "pinned" boolean NOT NULL DEFAULT false,
  "muted" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_thread_preference_user" UNIQUE ("thread_id", "user_id")
);--> statement-breakpoint
-- Como toda tabela pública: só a API (papel do servidor) lê e escreve. (Claude, 06/10: faltava.)
ALTER TABLE "message_thread_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "message_thread_preferences" FROM anon, authenticated, PUBLIC;
