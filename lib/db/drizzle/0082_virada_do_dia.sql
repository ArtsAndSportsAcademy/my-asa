-- Qual dia a Escala mostra ao abrir (24/10/2026). A escala de um dia costuma ser feita na noite anterior, então quem prepara o dia
-- precisa cair em amanhã à noite e voltar a cair em hoje de manhã. Cada local escolhe as duas horas (HH:MM): a partir de qual hora a
-- Escala passa a abrir no dia seguinte e a partir de qual hora volta a abrir em hoje. Padrão: 18:00 e 05:00.
-- Aditivo: duas colunas novas com valor padrão. Nada que existe é tocado, e local antigo já nasce com o padrão.
ALTER TABLE locations ADD COLUMN escala_abre_amanha_a_partir text NOT NULL DEFAULT '18:00';
--> statement-breakpoint
ALTER TABLE locations ADD COLUMN escala_volta_a_hoje_a_partir text NOT NULL DEFAULT '05:00';
