-- Desfaz a troca de folga com colega. Some o registro da proposta (colega, dia devolvido, resposta e
-- motivo) dos pedidos. Trocas já aplicadas continuam valendo no mapa de folgas: só o rastro no pedido se perde
-- (o Registro mantém o que aconteceu).
DROP INDEX IF EXISTS leave_requests_peer_idx;
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_peer_ck;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS swap_return_date;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS peer_reason;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS peer_responded_at;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS peer_accepted;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS peer_proposed_by;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS peer_id;
