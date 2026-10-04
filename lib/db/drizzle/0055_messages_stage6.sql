ALTER TABLE "message_threads" ADD COLUMN IF NOT EXISTS "group_id" uuid;
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE SET NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "quoted_message_id" uuid;
ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_messages_id_fk" FOREIGN KEY ("quoted_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS "message_thread_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL REFERENCES "public"."message_threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE, "pinned" boolean NOT NULL DEFAULT false,
  "muted" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_thread_preference_user" UNIQUE ("thread_id", "user_id")
);
