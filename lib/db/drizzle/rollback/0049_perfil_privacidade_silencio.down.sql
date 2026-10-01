-- Desfaz 0049. As fotos ficam no dump antes do rollback; nada é apagado sem backup.
DROP TABLE IF EXISTS user_photos;
ALTER TABLE organizations DROP COLUMN IF EXISTS regras;
ALTER TABLE users DROP COLUMN IF EXISTS silencio;
ALTER TABLE users DROP COLUMN IF EXISTS privacidade;
