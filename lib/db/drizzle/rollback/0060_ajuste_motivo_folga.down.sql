-- Desfaz 0060. Quem tinha sido chamado na folga volta a ficar fora da grade do dia, e o motivo
-- escrito some da tabela (o Registro de cada ajuste continua guardando o que foi feito).
ALTER TABLE "escala_bloco_ajustes" DROP COLUMN IF EXISTS "folga_decidida_em";
ALTER TABLE "escala_bloco_ajustes" DROP COLUMN IF EXISTS "mesmo_de_folga";
ALTER TABLE "escala_bloco_ajustes" DROP COLUMN IF EXISTS "motivo";
