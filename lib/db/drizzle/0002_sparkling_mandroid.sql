CREATE TYPE "public"."responsibility_assignment_role" AS ENUM('PRIMARY', 'SECONDARY');--> statement-breakpoint
CREATE TYPE "public"."asa_memory_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."asa_memory_type" AS ENUM('PERSONAL', 'OPERATIONAL', 'OFFICIAL');--> statement-breakpoint
CREATE TYPE "public"."asa_user_mode" AS ENUM('SILENT', 'BALANCED', 'PROACTIVE');--> statement-breakpoint
CREATE TYPE "public"."folga_origem" AS ENUM('MANUAL', 'SOLICITACAO');--> statement-breakpoint
CREATE TYPE "public"."folga_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."folga_type" AS ENUM('DAY_OFF', 'NO_SHOW', 'RECESSO', 'AFASTAMENTO', 'RESTRICAO', 'OUTRO');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "platform",
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "library_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"operation_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'OPERAÇÃO' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responsibility_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"responsibility_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role" "responsibility_assignment_role" DEFAULT 'PRIMARY' NOT NULL,
	"substitute_member_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asa_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text,
	"organization_id" uuid,
	"question" text NOT NULL,
	"response" text NOT NULL,
	"tools_used" jsonb DEFAULT '[]'::jsonb,
	"actions_executed" jsonb DEFAULT '[]'::jsonb,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asa_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "asa_memory_type" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"scope" text NOT NULL,
	"organization_id" uuid,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"status" "asa_memory_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asa_user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "asa_user_mode" DEFAULT 'BALANCED' NOT NULL,
	"morning_greeting" boolean DEFAULT true NOT NULL,
	"evening_greeting" boolean DEFAULT false NOT NULL,
	"reminders" boolean DEFAULT true NOT NULL,
	"birthday_alerts" boolean DEFAULT true NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"good_morning_time" text DEFAULT '07:00',
	"good_night_time" text DEFAULT '22:00',
	"message_frequency" text DEFAULT 'DAILY',
	"proactivity_level" text DEFAULT 'MEDIUM',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asa_user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "recognitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folgas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"type" "folga_type" DEFAULT 'DAY_OFF' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "folga_status" DEFAULT 'ACTIVE' NOT NULL,
	"origem" "folga_origem" DEFAULT 'MANUAL' NOT NULL,
	"request_id" uuid,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scale_allocations" ALTER COLUMN "agenda_event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD COLUMN "manual_date" date;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD COLUMN "manual_label" text;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_views" ADD CONSTRAINT "library_views_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_views" ADD CONSTRAINT "library_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibilities" ADD CONSTRAINT "responsibilities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibilities" ADD CONSTRAINT "responsibilities_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibility_assignments" ADD CONSTRAINT "responsibility_assignments_responsibility_id_responsibilities_id_fk" FOREIGN KEY ("responsibility_id") REFERENCES "public"."responsibilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibility_assignments" ADD CONSTRAINT "responsibility_assignments_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibility_assignments" ADD CONSTRAINT "responsibility_assignments_substitute_member_id_users_id_fk" FOREIGN KEY ("substitute_member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asa_audit_log" ADD CONSTRAINT "asa_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asa_memories" ADD CONSTRAINT "asa_memories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asa_memories" ADD CONSTRAINT "asa_memories_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asa_user_preferences" ADD CONSTRAINT "asa_user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_views_doc_idx" ON "library_views" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "library_views_user_idx" ON "library_views" USING btree ("user_id");