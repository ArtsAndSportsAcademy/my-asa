-- Tarefas em etapas (16/10/2026). Tudo aditivo; as tarefas que já existem ganham as etapas que elas já tinham.
--   * task_steps: cada etapa tem nome, pessoa, prazo próprio (opcional), checklist e estado. Aprovação é uma etapa
--     do tipo APPROVAL. A tarefa continua com status, assignee_id e due_date: o ASA, o Meu Dia e o Painel leem isso.
--   * tasks.ordering: SEQUENTIAL (fila: a próxima etapa só abre quando a anterior termina) ou FREE (solta).
--   * tasks.period_start: início do período, quando a tarefa vale um intervalo em vez de uma data. due_date passa a
--     poder ficar vazio (tarefa sem prazo).
--   * tasks.last_activity_at: última vez que alguém mexeu; é o que decide se a tarefa está "parada".
--   * task_evidences.step_id: o link do Drive pode pertencer a uma etapa.
CREATE TABLE task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1),
  kind text NOT NULL DEFAULT 'WORK' CHECK (kind IN ('WORK', 'APPROVAL')),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text,
  assignee_id uuid NOT NULL REFERENCES users(id),
  due_date date,
  status text NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'ACTIVE', 'DONE', 'DISPENSED')),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  done_at timestamptz,
  done_by_id uuid REFERENCES users(id),
  dispensed_reason text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX task_steps_task_position_uq ON task_steps (task_id, position) WHERE active;
--> statement-breakpoint
CREATE INDEX task_steps_assignee_ativa_idx ON task_steps (assignee_id) WHERE active AND status = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE task_steps FROM anon, authenticated, PUBLIC;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN ordering text NOT NULL DEFAULT 'SEQUENTIAL' CHECK (ordering IN ('SEQUENTIAL', 'FREE'));
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN period_start date;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE tasks ALTER COLUMN due_date DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE task_evidences ADD COLUMN step_id uuid REFERENCES task_steps(id);
--> statement-breakpoint
UPDATE tasks SET last_activity_at = updated_at;
--> statement-breakpoint
-- As tarefas que já existem: a etapa de trabalho (pessoa responsável, prazo e checklist obrigatório de hoje).
INSERT INTO task_steps (task_id, position, kind, title, assignee_id, due_date, status, checklist, done_at, done_by_id)
SELECT t.id, 1, 'WORK', 'Fazer', t.assignee_id, t.due_date,
  CASE WHEN t.status IN ('READY_FOR_APPROVAL', 'APPROVED', 'COMPLETED') THEN 'DONE' ELSE 'ACTIVE' END,
  COALESCE(t.mandatory_checklist, '[]'::jsonb),
  CASE WHEN t.status IN ('READY_FOR_APPROVAL', 'APPROVED', 'COMPLETED') THEN COALESCE(t.approved_at, t.completed_at, t.updated_at) END,
  CASE WHEN t.status IN ('READY_FOR_APPROVAL', 'APPROVED', 'COMPLETED') THEN t.assignee_id END
FROM tasks t;
--> statement-breakpoint
-- A etapa de aprovação, para quem pedia aprovação. Sem aprovador cadastrado, quem criou a tarefa aprova.
INSERT INTO task_steps (task_id, position, kind, title, assignee_id, due_date, status, done_at, done_by_id)
SELECT t.id, 2, 'APPROVAL', 'Aprovar', COALESCE(t.approver_id, t.creator_id), NULL,
  CASE WHEN t.status = 'READY_FOR_APPROVAL' THEN 'ACTIVE' WHEN t.status IN ('APPROVED', 'COMPLETED') THEN 'DONE' ELSE 'WAITING' END,
  CASE WHEN t.status IN ('APPROVED', 'COMPLETED') THEN COALESCE(t.approved_at, t.completed_at, t.updated_at) END,
  CASE WHEN t.status IN ('APPROVED', 'COMPLETED') THEN COALESCE(t.approver_id, t.creator_id) END
FROM tasks t WHERE t.requires_approval;
