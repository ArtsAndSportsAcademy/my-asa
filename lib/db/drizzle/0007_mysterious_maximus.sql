CREATE TABLE "recurring_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weekday" integer,
	"specific_date" text,
	"start_time" text,
	"end_time" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_activity_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"user_id" uuid,
	"group_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "show_book_blocks" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "show_book_blocks" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "show_books" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "show_books" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "show_books" ADD COLUMN "responsible_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_book_blocks" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "daily_book_blocks" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "delegations" ADD COLUMN "show_book_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_activities" ADD CONSTRAINT "recurring_activities_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_activity_assignees" ADD CONSTRAINT "recurring_activity_assignees_activity_id_recurring_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."recurring_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_activity_assignees" ADD CONSTRAINT "recurring_activity_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_activity_assignees" ADD CONSTRAINT "recurring_activity_assignees_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_books" ADD CONSTRAINT "show_books_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;