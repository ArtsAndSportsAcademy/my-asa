CREATE TYPE "public"."group_scope" AS ENUM('OPERATION', 'MULTI', 'ALL');--> statement-breakpoint
CREATE TABLE "group_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operational_groups" ALTER COLUMN "operation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_groups" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "operational_groups" ADD COLUMN "scope" "group_scope" DEFAULT 'OPERATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_operations" ADD CONSTRAINT "group_operations_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_operations" ADD CONSTRAINT "group_operations_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_groups" ADD CONSTRAINT "operational_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;