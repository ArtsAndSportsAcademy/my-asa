ALTER TABLE request_decisions ADD COLUMN reverted_at timestamptz;
--> statement-breakpoint
CREATE TABLE undo_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK (kind IN ('formation','library_document','group_member','leave_denial')),
 entity_id uuid NOT NULL, changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'array'),
 expires_at timestamptz NOT NULL, undone_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), undo_action_id uuid REFERENCES undo_actions(id),
 user_id uuid NOT NULL REFERENCES users(id), payload jsonb NOT NULL,
 deduplication_key text UNIQUE, due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','delivered','cancelled')),
 notification_id uuid REFERENCES user_notifications(id), attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 leased_until timestamptz, delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX notification_outbox_due_idx ON notification_outbox(status, due_at);
--> statement-breakpoint
CREATE TABLE web_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'), p256dh text NOT NULL, auth text NOT NULL,
 active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE pwa_installations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), installation_id uuid NOT NULL,
 installed_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT pwa_installation_user_device_uq UNIQUE(user_id, installation_id)
);
