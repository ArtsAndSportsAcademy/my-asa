-- Desfaz as Mensagens com grupos. Some a tabela de reações (as reações se perdem) e as colunas novas.
-- Figurinhas já enviadas continuam como mensagens de texto cujo conteúdo é o nome da figurinha
-- (o app anterior as mostra como esse texto). As conversas de grupo (GROUP e HOUSE_GROUP) continuam
-- existindo como conversas comuns, com os mesmos participantes.
DROP INDEX IF EXISTS messages_thread_created_idx;
DROP TABLE IF EXISTS message_reactions;
ALTER TABLE message_threads DROP COLUMN IF EXISTS closed_reason;
ALTER TABLE message_threads DROP COLUMN IF EXISTS closed_by;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_ck;
ALTER TABLE messages DROP COLUMN IF EXISTS kind;
