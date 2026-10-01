-- O Livro do Show passa a guardar o Local explicitamente. A operação continua
-- apenas para compatibilidade e autorização legada.
ALTER TYPE show_book_type ADD VALUE IF NOT EXISTS 'COMPLETE';
--> statement-breakpoint
ALTER TYPE show_book_type ADD VALUE IF NOT EXISTS 'CHARACTERS_ONLY';
--> statement-breakpoint
ALTER TABLE show_books ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);
--> statement-breakpoint
ALTER TABLE show_books ADD COLUMN IF NOT EXISTS uses_characters boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- Só preenche quando há um único local ativo associado à operação; os casos
-- ambíguos permanecem legíveis como legado e não são adivinhados.
UPDATE show_books book
SET location_id = source.location_id
FROM (
  SELECT operation_id, min(location_id::text)::uuid AS location_id
  FROM operation_locations
  WHERE active
  GROUP BY operation_id
  HAVING count(DISTINCT location_id) = 1
) source
WHERE book.operation_id = source.operation_id AND book.location_id IS NULL;
