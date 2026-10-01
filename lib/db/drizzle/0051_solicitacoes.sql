-- Solicitações do Elenco (tela nova, 01/10): horário na escala (peruca, gravar vídeo…), troca com
-- colega (o colega aceita antes), mudança de horário, restrição e outro assunto. A folga continua em
-- leave_requests (tela Folgas); aqui não entra folga nova.
ALTER TYPE "public"."request_type" ADD VALUE IF NOT EXISTS 'ESCALA_SLOT';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE IF NOT EXISTS 'WAITING_PEER';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE IF NOT EXISTS 'CANCELLED';--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "area_id" uuid REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "peer_id" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "peer_responded_at" timestamptz;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "subject" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "start_time" time;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "end_time" time;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "decided_by" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "decided_at" timestamptz;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "decision_reason" text;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_horario_ck" CHECK ("end_time" IS NULL OR "start_time" IS NULL OR "end_time" > "start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_org_status_idx" ON "requests" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_location_idx" ON "requests" ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_peer_idx" ON "requests" ("peer_id");
