-- Chamar alguém que está de folga (09/10). Folga continua vencendo por padrão: só entra no dia
-- quem foi chamado de propósito, com motivo escrito, pela Supervisão da área ou pela Administração.
ALTER TABLE "escala_bloco_ajustes" ADD COLUMN IF NOT EXISTS "motivo" text;--> statement-breakpoint
-- Marca o ajuste que vence a folga daquele dia; sem ela, a pessoa de folga continua fora da grade.
ALTER TABLE "escala_bloco_ajustes" ADD COLUMN IF NOT EXISTS "mesmo_de_folga" boolean NOT NULL DEFAULT false;--> statement-breakpoint
-- Quem é chamado na folga precisa de decisão depois: remarcar a folga ou deixar como está.
ALTER TABLE "escala_bloco_ajustes" ADD COLUMN IF NOT EXISTS "folga_decidida_em" timestamp with time zone;
