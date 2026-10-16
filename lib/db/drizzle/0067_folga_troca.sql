-- Troca de folga com colega (Etapa 3, 16/10/2026). Tudo aditivo: nenhum pedido existente muda.
-- Quando o colega JÁ está de folga no dia pedido, a Supervisão propõe a troca: a pessoa fica com o dia
-- pedido e o colega fica com um dia de folga dela (swap_return_date). O colega aceita ou recusa, com
-- motivo. O estado "esperando o colega" é derivado: peer_id preenchido e peer_accepted nulo; o status do
-- pedido continua PENDING (a troca não cria valor novo no tipo de status).
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS peer_id uuid REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS peer_proposed_by uuid REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS peer_accepted boolean;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS peer_responded_at timestamptz;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS peer_reason text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS swap_return_date date;
--> statement-breakpoint
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_peer_ck CHECK (
  (peer_id IS NULL AND peer_proposed_by IS NULL AND peer_accepted IS NULL AND peer_responded_at IS NULL AND swap_return_date IS NULL)
  OR (peer_id IS NOT NULL AND peer_proposed_by IS NOT NULL AND swap_return_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS leave_requests_peer_idx ON leave_requests(peer_id) WHERE peer_id IS NOT NULL;
