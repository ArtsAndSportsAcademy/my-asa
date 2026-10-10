-- O retrato inicial continua no Registro para auditoria, mas deixa de valer para a leitura.
-- As folgas reais não são alteradas pelo rollback.
UPDATE history_events
SET status = 'CANCELLED',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('rollbackAt', clock_timestamp())
WHERE action = 'FOLGA_MONTH_BASELINE'
  AND metadata->>'migration' = '0061_folgas_retrato_inicial'
  AND status = 'ACTIVE';
