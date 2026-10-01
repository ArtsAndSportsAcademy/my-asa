ALTER TYPE agenda_event_status ADD VALUE IF NOT EXISTS 'PROPOSED';
ALTER TYPE agenda_event_status ADD VALUE IF NOT EXISTS 'REJECTED';

DO $$ BEGIN
  CREATE TYPE agenda_participant_response AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CALLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE agenda_events
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS alternative_details text,
  ADD COLUMN IF NOT EXISTS alternative_date date,
  ADD COLUMN IF NOT EXISTS alternative_start_time time,
  ADD COLUMN IF NOT EXISTS alternative_end_time time;

ALTER TABLE agenda_event_participants
  ADD COLUMN IF NOT EXISTS response agenda_participant_response NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_note text;

CREATE INDEX IF NOT EXISTS agenda_events_area_date_idx ON agenda_events(area_id, date);
CREATE INDEX IF NOT EXISTS agenda_events_location_date_idx ON agenda_events(location_id, date);
CREATE INDEX IF NOT EXISTS agenda_event_participants_event_response_idx
  ON agenda_event_participants(event_id, response);
