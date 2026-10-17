-- Desfaz as tarefas em etapas.
-- O que se perde: as etapas (pessoas, prazos próprios, checklists por etapa, quem concluiu e quando), o modo
-- fila/solta, o início do período e o "última atividade". As tarefas voltam a ter uma pessoa, um prazo e o status
-- que já têm hoje na tabela tasks (o código novo mantém esses campos em dia, então nada de status se perde).
-- ATENÇÃO: due_date volta a ser obrigatório. Se existir tarefa sem prazo, o comando abaixo falha de propósito:
-- dê um prazo a essas tarefas (ou cancele-as) antes de desfazer, para não inventar uma data.
ALTER TABLE task_evidences DROP COLUMN IF EXISTS step_id;
ALTER TABLE tasks ALTER COLUMN due_date SET NOT NULL;
ALTER TABLE tasks DROP COLUMN IF EXISTS last_activity_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS period_start;
ALTER TABLE tasks DROP COLUMN IF EXISTS ordering;
DROP TABLE IF EXISTS task_steps;
