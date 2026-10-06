-- Desfaz 0055 (Mensagens da etapa 6). Perde fixar/silenciar por pessoa, a ligação da conversa com o
-- grupo operacional e a citação de mensagem; as conversas e mensagens continuam.
DROP TABLE IF EXISTS "message_thread_preferences";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_quoted_message_id_messages_id_fk";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "quoted_message_id";
ALTER TABLE "message_threads" DROP CONSTRAINT IF EXISTS "message_threads_group_id_operational_groups_id_fk";
ALTER TABLE "message_threads" DROP COLUMN IF EXISTS "group_id";
