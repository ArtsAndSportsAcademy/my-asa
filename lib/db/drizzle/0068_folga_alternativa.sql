-- Mediação do pedido de folga (Etapa 3, 16/10/2026). Tudo aditivo: nenhum pedido existente muda.
-- Quando só parte dos dias pedidos dá, a Supervisão propõe à pessoa só os dias que dão
-- (alternative_dates). A pessoa aceita ou recusa; recusando, o pedido volta para a Supervisão.
-- "Esperando a pessoa" é derivado: alternative_dates preenchido e alternative_accepted nulo; o status
-- continua PENDING (sem valor novo no tipo de status).
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS alternative_dates date[];
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS alternative_proposed_by uuid REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS alternative_accepted boolean;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS alternative_responded_at timestamptz;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS alternative_reason text;
--> statement-breakpoint
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_alternative_ck CHECK (
  (alternative_dates IS NULL AND alternative_proposed_by IS NULL AND alternative_accepted IS NULL AND alternative_responded_at IS NULL AND alternative_reason IS NULL)
  OR (alternative_dates IS NOT NULL AND cardinality(alternative_dates) > 0 AND alternative_proposed_by IS NOT NULL)
);
