CREATE TYPE "public"."agenda_visibility" AS ENUM('OPERATION', 'MANAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."message_participant_role" AS ENUM('INITIATOR', 'PARTICIPANT');--> statement-breakpoint
CREATE TYPE "public"."message_thread_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."notice_recipient_status" AS ENUM('PENDING', 'SENT', 'VIEWED', 'CONFIRMED', 'ESCALATED');--> statement-breakpoint
CREATE TYPE "public"."notice_status" AS ENUM('DRAFT', 'PUBLISHED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notice_type" AS ENUM('INFORMATIVE', 'IMPORTANT', 'PERSISTENT', 'ESCALATED');--> statement-breakpoint
CREATE TYPE "public"."user_notification_category" AS ENUM('schedule', 'book', 'notice', 'approval', 'absence', 'rehearsal', 'responsibility', 'message', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_notification_priority" AS ENUM('LOW', 'NORMAL', 'IMPORTANT', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."library_doc_status" AS ENUM('DRAFT', 'PUBLISHED', 'UPDATED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."library_doc_type" AS ENUM('OPERATIONAL_PROCEDURE', 'RULES_AND_POLICIES', 'CHARACTER_REFERENCE', 'COSTUME_REFERENCE', 'ONBOARDING_MATERIAL', 'SAFETY_PROCEDURE');--> statement-breakpoint
CREATE TYPE "public"."check_in_status" AS ENUM('EXPECTED', 'CHECKED_IN', 'LATE', 'ABSENT', 'EXCUSED');--> statement-breakpoint
CREATE TYPE "public"."task_evidence_type" AS ENUM('PHOTO', 'VIDEO', 'DOCUMENT', 'PDF', 'LINK', 'AUDIO', 'PRESENTATION');--> statement-breakpoint
CREATE TYPE "public"."task_origin" AS ENUM('MANUAL', 'REQUEST', 'LIBRARY', 'AI');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('CREATED', 'IN_PROGRESS', 'READY_FOR_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'VIEWED';--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'COMPLETED';--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'LATE';--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."delivery_type" ADD VALUE 'MANDATORY_READ';--> statement-breakpoint
ALTER TYPE "public"."delivery_type" ADD VALUE 'MANDATORY_VIDEO';--> statement-breakpoint
CREATE TABLE "show_book_position_library_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"show_book_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"label" text,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_thread_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "message_participant_role" DEFAULT 'PARTICIPANT' NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_thread_user" UNIQUE("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"title" text NOT NULL,
	"context_type" text,
	"context_id" text,
	"context_title" text,
	"created_by" uuid,
	"status" "message_thread_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notice_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"escalated_by" uuid,
	"reason" text,
	"escalated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid,
	"status" "notice_recipient_status" DEFAULT 'PENDING' NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_narratives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"operation_id" uuid,
	"title" text NOT NULL,
	"category" text DEFAULT 'OPERATIONAL_CHANGE' NOT NULL,
	"cause" text,
	"decision" text,
	"impact" text,
	"resolution" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_event_id" uuid NOT NULL,
	"target_event_id" uuid NOT NULL,
	"relation_type" text DEFAULT 'related_to' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"priority" "user_notification_priority" DEFAULT 'NORMAL' NOT NULL,
	"category" "user_notification_category" NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"action_url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "library_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_document_versions_document_id_version_unique" UNIQUE("document_id","version")
);
--> statement-breakpoint
CREATE TABLE "library_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"category_id" uuid,
	"type" "library_doc_type" NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"summary" text,
	"body" text DEFAULT '' NOT NULL,
	"status" "library_doc_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"responsible_id" uuid,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "check_in_status" DEFAULT 'EXPECTED' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"registered_by" uuid,
	"excuse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_checkin_user_operation_date" UNIQUE("user_id","operation_id","date")
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_evidences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"type" "task_evidence_type" NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"mandatory_evidence_ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"creator_id" uuid NOT NULL,
	"assignee_id" uuid NOT NULL,
	"approver_id" uuid,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "task_status" DEFAULT 'CREATED' NOT NULL,
	"due_date" date NOT NULL,
	"mandatory_checklist" jsonb DEFAULT '[]'::jsonb,
	"operational_checklist" jsonb DEFAULT '[]'::jsonb,
	"mandatory_evidences" jsonb DEFAULT '[]'::jsonb,
	"origin" "task_origin" DEFAULT 'MANUAL' NOT NULL,
	"library_document_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisor_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requestor_id" uuid NOT NULL,
	"requestor_operation_id" uuid NOT NULL,
	"target_supervisor_id" uuid,
	"target_operation_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"agenda_event_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"response_reason" text,
	"responded_at" timestamp with time zone,
	"responded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notices" ALTER COLUMN "urgency" SET DEFAULT 'INFORMATIVE';--> statement-breakpoint
ALTER TABLE "history_events" ALTER COLUMN "mo_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "history_events" ALTER COLUMN "entity_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "history_events" ALTER COLUMN "actor_type" SET DEFAULT 'HUMAN';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specialization" text;--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "late_threshold_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "operations" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "delegations" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "delegations" ADD COLUMN "responsibilities" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD COLUMN "visibility" "agenda_visibility" DEFAULT 'OPERATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_name" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "type" "notice_type" DEFAULT 'INFORMATIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "status" "notice_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "requires_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "delta_json" jsonb;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "auto_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "content_ref" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "checklist_items" jsonb;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN "checklist_progress" jsonb;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "category" text DEFAULT 'OPERATIONAL_CHANGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "narrative" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "actor_name" text;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "operation_id" uuid;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "history_events" ADD COLUMN "occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "show_book_position_library_refs" ADD CONSTRAINT "show_book_position_library_refs_position_id_show_book_roles_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."show_book_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_position_library_refs" ADD CONSTRAINT "show_book_position_library_refs_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_position_library_refs" ADD CONSTRAINT "show_book_position_library_refs_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_position_library_refs" ADD CONSTRAINT "show_book_position_library_refs_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_escalations" ADD CONSTRAINT "notice_escalations_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_escalations" ADD CONSTRAINT "notice_escalations_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_escalations" ADD CONSTRAINT "notice_escalations_escalated_by_users_id_fk" FOREIGN KEY ("escalated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_narratives" ADD CONSTRAINT "history_narratives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_relations" ADD CONSTRAINT "history_relations_source_event_id_history_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."history_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_relations" ADD CONSTRAINT "history_relations_target_event_id_history_events_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."history_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_category_id_library_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."library_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_check_ins" ADD CONSTRAINT "operational_check_ins_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_check_ins" ADD CONSTRAINT "operational_check_ins_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_check_ins" ADD CONSTRAINT "operational_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_check_ins" ADD CONSTRAINT "operational_check_ins_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidences" ADD CONSTRAINT "task_evidences_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidences" ADD CONSTRAINT "task_evidences_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_requestor_operation_id_operations_id_fk" FOREIGN KEY ("requestor_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_target_supervisor_id_users_id_fk" FOREIGN KEY ("target_supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_target_operation_id_operations_id_fk" FOREIGN KEY ("target_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_agenda_event_id_agenda_events_id_fk" FOREIGN KEY ("agenda_event_id") REFERENCES "public"."agenda_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_requests" ADD CONSTRAINT "supervisor_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE no action ON UPDATE no action;