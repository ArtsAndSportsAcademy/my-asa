-- Bloco 6: áreas/locais, supervisão por área+local e entidade HTTP.
-- Tudo é aditivo; o JSON legado operations.locations permanece até a migração
-- completa dos consumidores.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DIR';

CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS areas_organization_name_active_uq
  ON areas (organization_id, name) WHERE active;

CREATE TABLE IF NOT EXISTS area_local_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES areas(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  supervisor_id uuid NOT NULL REFERENCES users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS area_local_supervisors_active_pair_uq
  ON area_local_supervisors (area_id, location_id) WHERE active;
CREATE INDEX IF NOT EXISTS area_local_supervisors_supervisor_idx
  ON area_local_supervisors (supervisor_id);

CREATE TABLE IF NOT EXISTS operation_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES operations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS operation_locations_active_pair_uq
  ON operation_locations (operation_id, location_id) WHERE active;

ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_location_id uuid REFERENCES locations(id);
ALTER TABLE scales ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id);
ALTER TABLE scales ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

ALTER TABLE characters ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE character_cast ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Converte somente referências inequívocas do modelo legado. Nada é apagado.
INSERT INTO areas (organization_id, name)
SELECT DISTINCT o.organization_id, g.name
FROM operational_groups g
JOIN operations o ON o.id = g.operation_id
WHERE NOT EXISTS (
  SELECT 1 FROM areas a
  WHERE a.organization_id = o.organization_id AND a.name = g.name AND a.active
);

INSERT INTO operation_locations (operation_id, location_id)
SELECT o.id, l.id
FROM operations o
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(o.locations, '[]'::jsonb)) AS legacy_location(name)
JOIN locations l ON l.organization_id = o.organization_id AND l.name = legacy_location.name
WHERE NOT EXISTS (
  SELECT 1 FROM operation_locations ol
  WHERE ol.operation_id = o.id AND ol.location_id = l.id AND ol.active
);

UPDATE users u
SET area_id = source.area_id
FROM (
  SELECT ur.user_id, min(a.id::text)::uuid AS area_id
  FROM user_roles ur
  JOIN operational_groups g ON g.id = ur.group_id
  JOIN operations o ON o.id = ur.operation_id
  JOIN areas a ON a.organization_id = o.organization_id AND a.name = g.name AND a.active
  WHERE ur.active AND ur.group_id IS NOT NULL
  GROUP BY ur.user_id
  HAVING count(DISTINCT a.id) = 1
) source
WHERE u.id = source.user_id AND u.area_id IS NULL;
