-- Limites de folga por dia configuráveis e lembrete de resposta (16/10/2026, respostas da Babi). Tudo aditivo.
--   * limite_total_*: quantas pessoas da organização inteira (Snowland e Acquamotion juntos) podem estar de folga
--     no mesmo dia. Desligado por padrão. Modo REFERENCIA só avisa; EXIGE_MOTIVO deixa passar do limite só com motivo
--     escrito (nunca é uma trava absoluta).
--   * limite_area_ativo / limite_area_modo: liga/desliga o limite por área (os números continuam em limite_folga_por_area)
--     e escolhe se ele só avisa ou exige motivo. Quem já tinha limites por área continua com eles ligados, só avisando.
--   * lembrete_resposta_horas: depois de quantas horas sem resposta o colega da troca (ou a pessoa que recebeu a
--     proposta de dias) ganha um lembrete, uma vez. 0 desliga. Padrão 24.
ALTER TABLE folga_config
  ADD COLUMN limite_total_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN limite_total integer CHECK (limite_total IS NULL OR limite_total BETWEEN 0 AND 2000),
  ADD COLUMN limite_total_modo text NOT NULL DEFAULT 'REFERENCIA' CHECK (limite_total_modo IN ('REFERENCIA', 'EXIGE_MOTIVO')),
  ADD COLUMN limite_area_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN limite_area_modo text NOT NULL DEFAULT 'REFERENCIA' CHECK (limite_area_modo IN ('REFERENCIA', 'EXIGE_MOTIVO')),
  ADD COLUMN lembrete_resposta_horas integer NOT NULL DEFAULT 24 CHECK (lembrete_resposta_horas BETWEEN 0 AND 168);
