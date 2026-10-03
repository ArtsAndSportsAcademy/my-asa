CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  start_time text NOT NULL CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text NOT NULL CHECK (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  effective_from date NOT NULL,
  effective_to date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_time <> end_time),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shifts FROM anon, authenticated, PUBLIC;
CREATE INDEX shifts_org_effective_idx ON shifts(organization_id, effective_from, effective_to) WHERE active;
--> statement-breakpoint
ALTER TABLE operational_check_ins
  ADD COLUMN shift_id uuid REFERENCES shifts(id),
  ADD COLUMN shift_state text CHECK (shift_state IN ('EXPECTED','ARRIVED','LATE','ABSENT','NO_RESPONSE','LATE_UNCONFIRMED')),
  ADD COLUMN eta_minutes integer CHECK (eta_minutes BETWEEN 0 AND 1440),
  ADD COLUMN reason_code text CHECK (reason_code IN ('ILLNESS','PERSONAL','TRANSPORT','OTHER')),
  ADD COLUMN reported_at timestamptz,
  ADD COLUMN opens_at timestamptz,
  ADD COLUMN first_activity_at timestamptz,
  ADD COLUMN closes_at timestamptz,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN late_arrival boolean NOT NULL DEFAULT false,
  ADD COLUMN activities jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE operational_check_ins DROP CONSTRAINT uq_checkin_user_operation_date;
CREATE UNIQUE INDEX uq_checkin_user_operation_date ON operational_check_ins(user_id, operation_id, date) WHERE shift_id IS NULL;
CREATE UNIQUE INDEX uq_checkin_user_date_shift ON operational_check_ins(user_id, date, shift_id);
CREATE INDEX checkin_shifts_pending_idx ON operational_check_ins(closes_at) WHERE shift_id IS NOT NULL AND closed_at IS NULL;
