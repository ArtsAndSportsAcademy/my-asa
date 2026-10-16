-- Desfaz a mediação do pedido de folga. Some o rastro da proposta (dias propostos, quem propôs,
-- resposta e motivo) dos pedidos. Folgas já concedidas por proposta aceita continuam valendo no mapa;
-- o Registro mantém o que aconteceu.
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_alternative_ck;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS alternative_reason;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS alternative_responded_at;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS alternative_accepted;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS alternative_proposed_by;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS alternative_dates;
