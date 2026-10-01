-- Grupo B: pedidos de folga com regime versionado e presença por bloco da Escala.
CREATE TABLE IF NOT EXISTS leave_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  effective_from date NOT NULL,
  effective_to date,
  weekly_days integer NOT NULL,
  week_starts_on integer NOT NULL DEFAULT 4,
  recess_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT leave_regimes_weekly_days_ck CHECK (weekly_days BETWEEN 0 AND 7),
  CONSTRAINT leave_regimes_week_start_ck CHECK (week_starts_on BETWEEN 0 AND 6),
  CONSTRAINT leave_regimes_period_ck CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS leave_regimes_active_effective_from_uq ON leave_regimes (organization_id, effective_from) WHERE active;
--> statement-breakpoint
CREATE TYPE leave_request_status AS ENUM ('PENDING','APPROVED','DENIED','CANCELLED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  area_id uuid REFERENCES areas(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status leave_request_status NOT NULL DEFAULT 'PENDING',
  decided_by uuid REFERENCES users(id),
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_range_ck CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_decision_ck CHECK ((status IN ('APPROVED','DENIED') AND decided_by IS NOT NULL AND decision_reason IS NOT NULL) OR status IN ('PENDING','CANCELLED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS leave_requests_pending_range_uq ON leave_requests (user_id, start_date, end_date) WHERE status = 'PENDING';
--> statement-breakpoint
CREATE TYPE day_checkin_status AS ENUM ('EXPECTED','CHECKED_IN','LATE','ABSENT','EXCUSED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS day_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scales(id),
  source_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  status day_checkin_status NOT NULL DEFAULT 'EXPECTED',
  checked_in_at timestamptz,
  eta_minutes integer,
  reason text,
  registered_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_checkins_eta_ck CHECK (eta_minutes IS NULL OR eta_minutes >= 0),
  CONSTRAINT day_checkins_reason_ck CHECK ((status IN ('ABSENT','EXCUSED') AND btrim(coalesce(reason, '')) <> '') OR status NOT IN ('ABSENT','EXCUSED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS day_checkins_scale_source_user_uq ON day_check_ins (scale_id, source_key, user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS daily_book_checkin_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_book_id uuid NOT NULL REFERENCES daily_books(id),
  assignment_id uuid NOT NULL REFERENCES daily_book_assignments(id),
  check_in_id uuid NOT NULL REFERENCES day_check_ins(id),
  active boolean NOT NULL DEFAULT true,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS daily_book_checkin_vacancy_active_assignment_uq ON daily_book_checkin_vacancies (assignment_id) WHERE active;
--> statement-breakpoint
ALTER TABLE public.leave_regimes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.day_check_ins ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.daily_book_checkin_vacancies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.leave_regimes, public.leave_requests, public.day_check_ins, public.daily_book_checkin_vacancies FROM PUBLIC, anon, authenticated;
