ALTER TABLE formations ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE formations f
SET organization_id = o.organization_id
FROM show_books sb
JOIN operations o ON o.id = sb.operation_id
WHERE f.show_id = sb.id
  AND f.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS formations_organization_active_idx
  ON formations (organization_id, active, people_count);
