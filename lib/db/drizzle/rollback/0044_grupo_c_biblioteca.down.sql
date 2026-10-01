ALTER TABLE library_views DROP COLUMN IF EXISTS confirmed_at;
--> statement-breakpoint
ALTER TABLE library_documents DROP CONSTRAINT IF EXISTS library_documents_scope_ck;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS location_id;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS area_id;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS scope_type;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS requires_confirmation;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS tags;
--> statement-breakpoint
ALTER TABLE library_documents DROP COLUMN IF EXISTS file_url;
