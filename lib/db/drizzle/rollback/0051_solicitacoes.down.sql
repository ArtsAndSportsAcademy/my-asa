-- Desfaz 0051 (colunas novas de Solicitações). Os valores novos dos tipos (ESCALA_SLOT, WAITING_PEER,
-- CANCELLED) ficam: o Postgres não remove valor de enum; sem as telas, nada os usa.
DROP INDEX IF EXISTS "requests_peer_idx";
DROP INDEX IF EXISTS "requests_location_idx";
DROP INDEX IF EXISTS "requests_org_status_idx";
ALTER TABLE "requests" DROP CONSTRAINT IF EXISTS "requests_horario_ck";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "decision_reason";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "decided_at";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "decided_by";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "end_time";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "start_time";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "subject";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "peer_responded_at";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "peer_id";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "location_id";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "area_id";
ALTER TABLE "requests" DROP COLUMN IF EXISTS "organization_id";
