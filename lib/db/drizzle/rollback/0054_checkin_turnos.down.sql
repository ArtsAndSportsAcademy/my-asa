-- Rollback manual. Preserva todas as configurações e presenças existentes.
-- Nenhum turno é apagado, nem mesmo os desativados, sem migração de dados aprovada.
BEGIN;
LOCK TABLE operational_check_ins, shifts IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM shifts) OR EXISTS (SELECT 1 FROM operational_check_ins WHERE shift_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback 0054 recusado: existem configurações ou check-ins por turno. Preserve e migre esses dados primeiro.';
  END IF;
END $$;
DROP INDEX IF EXISTS checkin_shifts_pending_idx;
DROP INDEX IF EXISTS uq_checkin_user_date_shift;
DROP INDEX IF EXISTS uq_checkin_user_operation_date;
ALTER TABLE operational_check_ins
  DROP COLUMN shift_id,
  DROP COLUMN shift_state,
  DROP COLUMN eta_minutes,
  DROP COLUMN reason_code,
  DROP COLUMN reported_at,
  DROP COLUMN opens_at,
  DROP COLUMN first_activity_at,
  DROP COLUMN closes_at,
  DROP COLUMN closed_at,
  DROP COLUMN late_arrival,
  DROP COLUMN activities;
ALTER TABLE operational_check_ins ADD CONSTRAINT uq_checkin_user_operation_date UNIQUE (user_id, operation_id, date);
DROP TABLE shifts;
COMMIT;
