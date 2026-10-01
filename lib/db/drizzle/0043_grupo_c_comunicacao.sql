-- Grupo C: um único mural para avisos e reconhecimentos.
CREATE TYPE announcement_type AS ENUM ('NOTICE', 'RECOGNITION', 'BIRTHDAY', 'TENURE');
--> statement-breakpoint
CREATE TYPE announcement_scope AS ENUM ('HOUSE', 'AREA', 'LOCATION');
--> statement-breakpoint
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  author_id uuid NOT NULL REFERENCES users(id),
  type announcement_type NOT NULL DEFAULT 'NOTICE',
  scope announcement_scope NOT NULL DEFAULT 'HOUSE',
  area_id uuid REFERENCES areas(id),
  location_id uuid REFERENCES locations(id),
  recipient_id uuid REFERENCES users(id),
  title text,
  body text NOT NULL,
  reason text,
  requires_confirmation boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_scope_target_ck CHECK (
    (scope = 'HOUSE' AND area_id IS NULL AND location_id IS NULL) OR
    (scope = 'AREA' AND area_id IS NOT NULL) OR
    (scope = 'LOCATION' AND location_id IS NOT NULL)
  ),
  CONSTRAINT announcements_recognition_reason_ck CHECK (
    type <> 'RECOGNITION' OR (recipient_id IS NOT NULL AND btrim(coalesce(reason, '')) <> '')
  )
);
--> statement-breakpoint
CREATE INDEX announcements_org_published_idx ON announcements (org_id, published_at);
--> statement-breakpoint
CREATE INDEX announcements_recipient_idx ON announcements (recipient_id);
--> statement-breakpoint
CREATE TABLE announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id),
  user_id uuid NOT NULL REFERENCES users(id),
  read_at timestamptz,
  confirmed_at timestamptz,
  reaction text,
  reacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_announcement_user_uq UNIQUE (announcement_id, user_id)
);
--> statement-breakpoint
CREATE TABLE announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_comments_body_ck CHECK (btrim(body) <> '')
);
--> statement-breakpoint
CREATE INDEX announcement_comments_post_idx ON announcement_comments (announcement_id, created_at);
--> statement-breakpoint
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.announcements, public.announcement_reads, public.announcement_comments FROM PUBLIC, anon, authenticated;
