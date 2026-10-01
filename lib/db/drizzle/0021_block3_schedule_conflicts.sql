DO $$ BEGIN
  CREATE TYPE "schedule_conflict_severity" AS ENUM ('leve', 'grave');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "schedule_conflict_state" AS ENUM ('aberto', 'ciente', 'resolvido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "schedule_conflict_source" AS ENUM ('sessao', 'agenda', 'escala', 'atividade');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "schedule_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "date" date NOT NULL,
  "first_source_type" "schedule_conflict_source" NOT NULL,
  "first_source_id" text NOT NULL,
  "first_label" text NOT NULL,
  "first_start_time" time NOT NULL,
  "first_end_time" time NOT NULL,
  "second_source_type" "schedule_conflict_source" NOT NULL,
  "second_source_id" text NOT NULL,
  "second_label" text NOT NULL,
  "second_start_time" time NOT NULL,
  "second_end_time" time NOT NULL,
  "overlap_minutes" integer NOT NULL,
  "severity" "schedule_conflict_severity" NOT NULL,
  "state" "schedule_conflict_state" NOT NULL DEFAULT 'aberto',
  "acknowledged_by" uuid REFERENCES "users"("id"),
  "acknowledged_at" timestamptz,
  "acknowledgement_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "schedule_conflicts_first_interval_ck" CHECK ("first_end_time" > "first_start_time"),
  CONSTRAINT "schedule_conflicts_second_interval_ck" CHECK ("second_end_time" > "second_start_time"),
  CONSTRAINT "schedule_conflicts_overlap_positive_ck" CHECK ("overlap_minutes" > 0),
  CONSTRAINT "schedule_conflicts_reason_nonblank_ck" CHECK ("acknowledgement_reason" IS NULL OR btrim("acknowledgement_reason") <> ''),
  CONSTRAINT "schedule_conflicts_ack_consistency_ck" CHECK (
    "state" <> 'ciente'
    OR ("acknowledged_by" IS NOT NULL AND "acknowledged_at" IS NOT NULL AND "acknowledgement_reason" IS NOT NULL AND btrim("acknowledgement_reason") <> '')
  ),
  CONSTRAINT "schedule_conflicts_pair_uq" UNIQUE ("user_id", "date", "first_source_type", "first_source_id", "second_source_type", "second_source_id")
);

CREATE INDEX IF NOT EXISTS "schedule_conflicts_user_date_idx" ON "schedule_conflicts" ("user_id", "date");
