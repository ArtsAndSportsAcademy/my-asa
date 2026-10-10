-- Antes da primeira publicação mensal, o Elenco via as folgas ativas diretamente no mapa.
-- Esta foto preserva o que já estava visível na passagem para a leitura por versão publicada.
-- Não a chamamos de publicação: a Administração continua responsável pelo primeiro clique.
WITH meses AS (
  SELECT DISTINCT f.operation_id,
    serie.inicio::date AS inicio
  FROM folgas f
  CROSS JOIN LATERAL generate_series(
    GREATEST(date_trunc('month', f.start_date)::date, date_trunc('month', timezone('America/Sao_Paulo', clock_timestamp()))::date),
    LEAST(date_trunc('month', f.end_date)::date, (date_trunc('month', timezone('America/Sao_Paulo', clock_timestamp())) + interval '23 months')::date),
    interval '1 month'
  ) AS serie(inicio)
  WHERE f.status = 'ACTIVE'
    AND f.end_date >= date_trunc('month', timezone('America/Sao_Paulo', clock_timestamp()))::date
)
INSERT INTO history_events (
  org_id, category, title, narrative, entity_type, entity_id, actor_type, actor_name,
  operation_id, action, after_state, metadata
)
SELECT o.organization_id, 'ABSENCE', 'Retrato inicial de folgas preservado',
  'Folgas já visíveis ao Elenco antes da primeira publicação mensal foram preservadas. A Administração ainda precisa publicar o mês.',
  'folga_mes', m.operation_id::text || ':' || to_char(m.inicio, 'YYYY-MM'),
  'DETERMINISTIC_ENGINE', 'My ASA', m.operation_id, 'FOLGA_MONTH_BASELINE',
  jsonb_build_object('folgas', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id, 'userId', f.user_id, 'userName', u.nome_de_exibicao,
      'operationId', f.operation_id, 'type', f.type,
      'startDate', f.start_date, 'endDate', f.end_date, 'status', 'ACTIVE'
    ) ORDER BY f.start_date, f.user_id, f.id)
    FROM folgas f
    JOIN users u ON u.id = f.user_id
    WHERE f.operation_id = m.operation_id AND f.status = 'ACTIVE'
      AND f.start_date < (m.inicio + interval '1 month')::date
      AND f.end_date >= m.inicio
  ), '[]'::jsonb)),
  jsonb_build_object('migration', '0061_folgas_retrato_inicial', 'month', to_char(m.inicio, 'YYYY-MM'))
FROM meses m
JOIN operations o ON o.id = m.operation_id
WHERE NOT EXISTS (
  SELECT 1 FROM history_events h
  WHERE h.entity_id = m.operation_id::text || ':' || to_char(m.inicio, 'YYYY-MM')
    AND h.action IN ('FOLGA_MONTH_PUBLISHED', 'FOLGA_MONTH_BASELINE')
    AND h.status = 'ACTIVE'
);
