-- WARNING: restoring the previous configuration exposes these tables through
-- inherited Supabase grants. Use only in an isolated environment or after
-- blocking the public Data API. Never run automatically as a production rollback.
BEGIN;
ALTER TABLE undo_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox DISABLE ROW LEVEL SECURITY;
ALTER TABLE web_push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_installations DISABLE ROW LEVEL SECURITY;
COMMIT;
