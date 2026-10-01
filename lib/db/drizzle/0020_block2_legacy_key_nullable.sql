-- A chave textual do Bloco 1 fica apenas como proveniência histórica.
-- Novos avanços usam exclusivamente rotation_daily_advances.character_id (UUID).
ALTER TABLE "rotation_daily_advances"
	ALTER COLUMN "legacy_character_key" DROP NOT NULL;
