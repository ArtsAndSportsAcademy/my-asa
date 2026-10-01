-- The app uses its authenticated HTTP API, not Supabase's anonymous table API.
-- No policies are deliberately provided: anon/authenticated cannot access these
-- operational snapshots, browser keys or notification payloads. The trusted
-- server DB role (postgres / BYPASSRLS) remains responsible for HTTP authorization.
ALTER TABLE undo_actions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE pwa_installations ENABLE ROW LEVEL SECURITY;
