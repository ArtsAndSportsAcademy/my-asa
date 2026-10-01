-- Complemento aditivo do Bloco 6: remoção lógica, sem perder Registro.
ALTER TABLE occurrences ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Reversão de schema (somente depois de exportar o estado de active):
-- ALTER TABLE occurrences DROP COLUMN active;
