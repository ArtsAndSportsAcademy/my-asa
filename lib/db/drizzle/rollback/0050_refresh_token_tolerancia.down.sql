-- Desfaz 0050 (a renovação volta a não ter tolerância).
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS replaced_by;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS rotated_at;
