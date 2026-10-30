-- Tempo disponível na Escala do dia (30/10/2026). Quando alguém fica um bom tempo sem nada entre duas atividades do mesmo dia, a Atenção do
-- dia avisa a Supervisão e a Administração. Cada local liga ou desliga o aviso e escolhe a partir de quantos minutos ele vale.
-- Padrão: ligado, 30 minutos. Local que já existe nasce com o padrão (a Administração desliga em Cadastros, Locais, se não quiser).
-- Aditivo: duas colunas novas com valor padrão. Nada que existe é tocado.
ALTER TABLE locations ADD COLUMN tempo_disponivel_ligado boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE locations ADD COLUMN tempo_disponivel_minutos integer NOT NULL DEFAULT 30;
