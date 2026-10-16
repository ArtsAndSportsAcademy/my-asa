-- Desfaz as regras configuráveis do pedido de folga. As configurações salvas se perdem; o app volta
-- aos padrões (prazo de 3 dias, nenhum limite por área).
DROP TABLE IF EXISTS folga_config;
