-- Mensagens estilo WhatsApp, versão profissional (15/10): grupos, reações e figurinhas.
-- Tudo aditivo — nenhuma mensagem existente muda.
--   * messages.kind: TEXT (padrão) ou STICKER (figurinha da ASA; o conteúdo é o nome da figurinha).
--   * message_threads.closed_by / closed_reason: quem arquivou o grupo e por quê (a Administração e a
--     Direção arquivam grupo com motivo; o conteúdo da conversa continua só dos participantes).
--   * message_reactions: uma reação por pessoa em cada mensagem (como no Mural), sem Registro.
--   * índice (thread_id, created_at): a conversa e o "não lidas" passam a ler por ele.
-- Os tipos de conversa vivem em message_threads.context_type (texto): DIRECT, GROUP (criado por uma
-- pessoa), HOUSE_GROUP (criado pela Administração/Direção), AREA_GROUP (automático, já existia).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'TEXT';
ALTER TABLE messages ADD CONSTRAINT messages_kind_ck CHECK (kind IN ('TEXT', 'STICKER'));
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id);
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS closed_reason text;
--> statement-breakpoint
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id),
  user_id uuid NOT NULL REFERENCES users(id),
  emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_message_user_uq UNIQUE (message_id, user_id)
);
--> statement-breakpoint
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE message_reactions FROM anon, authenticated, PUBLIC;
CREATE INDEX message_reactions_message_idx ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON messages(thread_id, created_at);
