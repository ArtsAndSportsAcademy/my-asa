ALTER TYPE task_origin ADD VALUE IF NOT EXISTS 'PERSON';
ALTER TYPE task_origin ADD VALUE IF NOT EXISTS 'ASA';

ALTER TABLE responsibilities
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS responsibility_id uuid REFERENCES responsibilities(id);

CREATE INDEX IF NOT EXISTS responsibilities_org_area_active_idx
  ON responsibilities(org_id, area_id, active);
CREATE INDEX IF NOT EXISTS tasks_responsibility_due_idx
  ON tasks(responsibility_id, due_date);
