-- Desfaz o horário só de uma pessoa na Escala do dia.
-- O que se perde: os ajustes de horário (ação HORARIO) são APAGADOS, porque a regra antiga só aceita ADICIONAR e REMOVER. As pessoas que
-- tinham horário próprio voltam ao horário normal da atividade. Os ajustes de adicionar e remover não são tocados. Os eventos do Registro
-- ("Horário só de uma pessoa mudado") continuam onde estão. Rode ANTES de voltar o código para uma versão sem o horário só da pessoa.
DELETE FROM escala_bloco_ajustes WHERE action = 'HORARIO';
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes DROP CONSTRAINT escala_bloco_ajustes_action_ck;
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes ADD CONSTRAINT escala_bloco_ajustes_action_ck CHECK (action IN ('ADICIONAR','REMOVER'));
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes DROP COLUMN IF EXISTS novo_fim;
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes DROP COLUMN IF EXISTS novo_inicio;
