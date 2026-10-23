-- Horário só de uma pessoa na Escala do dia (23/10/2026). Quando alguém cai em duas atividades ao mesmo tempo, hoje só dá para tirar a
-- pessoa de uma delas. Agora também dá para mudar o horário de uma atividade só para ela (treino de gelo às 10:20 para quem tem boas-vindas
-- às 10:00), sem mexer no horário dos outros nem na Programação. O ajuste passa a aceitar a ação HORARIO, com o novo início e o novo fim.
-- Aditivo: duas colunas novas e a lista de ações aceitas ganha um valor. Nada que existe é tocado.
ALTER TABLE escala_bloco_ajustes ADD COLUMN novo_inicio text;
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes ADD COLUMN novo_fim text;
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes DROP CONSTRAINT escala_bloco_ajustes_action_ck;
--> statement-breakpoint
ALTER TABLE escala_bloco_ajustes ADD CONSTRAINT escala_bloco_ajustes_action_ck CHECK (action IN ('ADICIONAR','REMOVER','HORARIO'));
