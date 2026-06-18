CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."operation_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."restriction_status" AS ENUM('ACTIVE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."restriction_type" AS ENUM('PHYSICAL', 'HEALTH', 'SCHEDULE', 'ROLE', 'TECHNICAL', 'PERSONAL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SUPERVISOR_A', 'SUPERVISOR_B', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."show_book_line_type" AS ENUM('FIXED_PERSON', 'TITULAR_SUBSTITUTE', 'ROTATION', 'DAY_OF_WEEK', 'FUNCTION', 'CHARACTER', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."show_book_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."show_book_tag_category" AS ENUM('ARTISTIC_SKILL', 'TECHNICAL_SKILL', 'PHYSICAL_REQUIREMENT', 'MEDICAL_REQUIREMENT', 'SAFETY', 'PROFESSIONAL_CERTIFICATION', 'CHARACTER', 'COSTUME', 'EQUIPMENT', 'SPACE', 'ADMINISTRATIVE');--> statement-breakpoint
CREATE TYPE "public"."show_book_type" AS ENUM('SIMPLE', 'STRUCTURED');--> statement-breakpoint
CREATE TYPE "public"."show_book_version_change_type" AS ENUM('STRUCTURAL', 'CONFIG');--> statement-breakpoint
CREATE TYPE "public"."agenda_event_status" AS ENUM('DRAFT', 'CONFIRMED', 'SUSPENDED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."agenda_event_type" AS ENUM('SHOW', 'REHEARSAL', 'MEETING', 'OPERATIONAL_BLOCK', 'COLLECTIVE_VACATION');--> statement-breakpoint
CREATE TYPE "public"."allocation_exception_type" AS ENUM('NO_CANDIDATE', 'RESTRICTION', 'CONFLICT', 'INSUFFICIENT_COVERAGE', 'SUPERVISOR_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('ASSIGNED', 'OPEN', 'CONFLICT', 'MANUAL_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."scale_status" AS ENUM('DRAFT', 'PUBLISHED', 'REPUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."daily_book_assignment_status" AS ENUM('ASSIGNED', 'AT_RISK', 'OPEN', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."daily_book_status" AS ENUM('DRAFT', 'PUBLISHED', 'REPUBLISHED', 'EXECUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."request_decision" AS ENUM('APPROVED', 'DENIED', 'ALTERNATIVE_PROPOSED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'ALTERNATIVE_PROPOSED', 'ALTERNATIVE_ACCEPTED', 'ALTERNATIVE_REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('LEAVE', 'ROLE_RESTRICTION', 'PHYSICAL_RESTRICTION', 'HEALTH_RESTRICTION', 'SCHEDULE_CHANGE', 'SWAP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."message_context_type" AS ENUM('REQUEST', 'DELIVERY', 'NOTICE', 'MO', 'DAILY_BOOK', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."notice_urgency" AS ENUM('INFORMATIVE', 'IMPORTANT', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."delivery_assignment_status" AS ENUM('PUBLISHED', 'RECEIVED', 'VIEWED', 'COMPLETED', 'OVERDUE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('READING', 'VIDEO', 'OPERATIONAL_UPDATE', 'CHECKLIST');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('HUMAN', 'DETERMINISTIC_ENGINE', 'LLM_CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."mo_type" AS ENUM('MO_PUBLICACAO_ESCALA', 'MO_APROVACAO_FOLGA', 'MO_NOVA_RESTRICAO', 'MO_CANCELAMENTO_SHOW', 'MO_SUBSTITUICAO', 'MO_AJUSTE_ESCALA', 'MO_PUBLICACAO_LIVRO_DIA', 'MO_REPUBLICACAO_LIVRO_DIA', 'MO_CANCELAMENTO_SOLICITACAO', 'MO_DELEGACAO_CRIADA', 'MO_DELEGACAO_EXPIRADA', 'MO_RESTRICAO_CRIADA', 'MO_RESTRICAO_EXPIRADA', 'MO_MEMBRO_ADICIONADO', 'MO_PAPEL_ALTERADO');--> statement-breakpoint
CREATE TYPE "public"."security_audit_action" AS ENUM('LOGIN', 'LOGOUT', 'PERMISSION_DENIED', 'TOKEN_EXPIRED', 'INVALID_ACCESS_ATTEMPT', 'TOKEN_REFRESHED', 'DEVICE_REGISTERED', 'USER_CREATED', 'USER_UPDATED', 'USER_STATUS_CHANGED', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'OPERATION_CREATED', 'OPERATION_UPDATED', 'GROUP_CREATED', 'GROUP_UPDATED', 'MEMBER_ADDED', 'MEMBER_REMOVED');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"photo_url" text,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "operational_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "group_status" DEFAULT 'ACTIVE' NOT NULL,
	"supervisor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "operation_status" DEFAULT 'ACTIVE' NOT NULL,
	"health_thresholds" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delegator_id" uuid NOT NULL,
	"delegatee_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "restriction_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "restriction_status" DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"group_id" uuid,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_book_id" uuid NOT NULL,
	"scene_id" uuid,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"type" "show_book_line_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_book_id" uuid NOT NULL,
	"block_id" uuid,
	"name" text NOT NULL,
	"minimum_coverage" integer DEFAULT 1 NOT NULL,
	"tags_json" jsonb DEFAULT '[]'::jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"category" "show_book_tag_category" NOT NULL,
	"label" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_book_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_book_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_type" "show_book_version_change_type" NOT NULL,
	"reason" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "show_book_type" DEFAULT 'STRUCTURED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "show_book_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"show_book_id" uuid,
	"group_id" uuid,
	"type" "agenda_event_type" NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"location" text,
	"notes" text,
	"status" "agenda_event_status" DEFAULT 'DRAFT' NOT NULL,
	"reason" text,
	"created_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"suspended_by" uuid,
	"suspended_at" timestamp with time zone,
	"canceled_by" uuid,
	"canceled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"eligible" boolean DEFAULT false NOT NULL,
	"compatible" boolean DEFAULT false NOT NULL,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"rejection_reason" text,
	"candidate_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"agenda_event_id" uuid,
	"position_id" uuid,
	"type" "allocation_exception_type" NOT NULL,
	"reason" text NOT NULL,
	"impact" text,
	"candidates_analyzed" jsonb DEFAULT '[]'::jsonb,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scale_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"agenda_event_id" uuid NOT NULL,
	"position_id" uuid,
	"user_id" uuid,
	"status" "allocation_status" DEFAULT 'OPEN' NOT NULL,
	"overridden_by" uuid,
	"override_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"group_id" uuid,
	"agenda_event_id" uuid,
	"show_book_id" uuid,
	"title" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "scale_status" DEFAULT 'DRAFT' NOT NULL,
	"generated_at" timestamp with time zone,
	"generated_by" uuid,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"republished_at" timestamp with time zone,
	"republished_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_book_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"user_id" uuid,
	"status" "daily_book_assignment_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_book_id" uuid NOT NULL,
	"scene_id" uuid,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"source_block_id" uuid,
	"is_removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_book_id" uuid NOT NULL,
	"block_id" uuid,
	"name" text NOT NULL,
	"minimum_coverage" integer DEFAULT 1 NOT NULL,
	"source_role_id" uuid,
	"is_removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"source_scene_id" uuid,
	"is_removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_event_id" uuid NOT NULL,
	"scale_id" uuid,
	"show_book_id" uuid,
	"status" "daily_book_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb,
	"republish_delta_json" jsonb,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"generated_at" timestamp with time zone,
	"generated_by" uuid,
	"executed_at" timestamp with time zone,
	"executed_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"decision" "request_decision" NOT NULL,
	"reason" text,
	"alternative_details" text,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"type" "request_type" NOT NULL,
	"status" "request_status" DEFAULT 'PENDING' NOT NULL,
	"target_dates" date[] NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid,
	"group_id" uuid,
	"context_type" "message_context_type",
	"context_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"urgency" "notice_urgency" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"type" "delivery_type" NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"due_date" date NOT NULL,
	"max_due_date" date NOT NULL,
	"status" "delivery_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "delivery_assignment_status" DEFAULT 'PUBLISHED' NOT NULL,
	"completed_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "mo_type" NOT NULL,
	"actor_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"correlation_id" uuid NOT NULL,
	"triggered_by_type" text,
	"triggered_by_id" uuid,
	"affected_entities" jsonb DEFAULT '[]' NOT NULL,
	"context" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mo_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" "security_audit_action" NOT NULL,
	"target_resource" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"device_token" text,
	"platform" "platform",
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "operational_groups" ADD CONSTRAINT "operational_groups_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_groups" ADD CONSTRAINT "operational_groups_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operations" ADD CONSTRAINT "operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_users_id_fk" FOREIGN KEY ("delegator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegatee_id_users_id_fk" FOREIGN KEY ("delegatee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_blocks" ADD CONSTRAINT "show_book_blocks_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_blocks" ADD CONSTRAINT "show_book_blocks_scene_id_show_book_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."show_book_scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_lines" ADD CONSTRAINT "show_book_lines_position_id_show_book_roles_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."show_book_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_roles" ADD CONSTRAINT "show_book_roles_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_roles" ADD CONSTRAINT "show_book_roles_block_id_show_book_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."show_book_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_scenes" ADD CONSTRAINT "show_book_scenes_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_tags" ADD CONSTRAINT "show_book_tags_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_tags" ADD CONSTRAINT "show_book_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_versions" ADD CONSTRAINT "show_book_versions_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_book_versions" ADD CONSTRAINT "show_book_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_books" ADD CONSTRAINT "show_books_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_books" ADD CONSTRAINT "show_books_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_tag_id_show_book_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."show_book_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_canceled_by_users_id_fk" FOREIGN KEY ("canceled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_candidates" ADD CONSTRAINT "allocation_candidates_scale_id_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_candidates" ADD CONSTRAINT "allocation_candidates_allocation_id_scale_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."scale_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_candidates" ADD CONSTRAINT "allocation_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_exceptions" ADD CONSTRAINT "allocation_exceptions_scale_id_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_exceptions" ADD CONSTRAINT "allocation_exceptions_agenda_event_id_agenda_events_id_fk" FOREIGN KEY ("agenda_event_id") REFERENCES "public"."agenda_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_exceptions" ADD CONSTRAINT "allocation_exceptions_position_id_show_book_roles_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."show_book_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_exceptions" ADD CONSTRAINT "allocation_exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD CONSTRAINT "scale_allocations_scale_id_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD CONSTRAINT "scale_allocations_agenda_event_id_agenda_events_id_fk" FOREIGN KEY ("agenda_event_id") REFERENCES "public"."agenda_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD CONSTRAINT "scale_allocations_position_id_show_book_roles_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."show_book_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD CONSTRAINT "scale_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_allocations" ADD CONSTRAINT "scale_allocations_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_agenda_event_id_agenda_events_id_fk" FOREIGN KEY ("agenda_event_id") REFERENCES "public"."agenda_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_republished_by_users_id_fk" FOREIGN KEY ("republished_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scales" ADD CONSTRAINT "scales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_assignments" ADD CONSTRAINT "daily_book_assignments_daily_book_id_daily_books_id_fk" FOREIGN KEY ("daily_book_id") REFERENCES "public"."daily_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_assignments" ADD CONSTRAINT "daily_book_assignments_position_id_daily_book_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."daily_book_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_assignments" ADD CONSTRAINT "daily_book_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_blocks" ADD CONSTRAINT "daily_book_blocks_daily_book_id_daily_books_id_fk" FOREIGN KEY ("daily_book_id") REFERENCES "public"."daily_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_blocks" ADD CONSTRAINT "daily_book_blocks_scene_id_daily_book_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."daily_book_scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_positions" ADD CONSTRAINT "daily_book_positions_daily_book_id_daily_books_id_fk" FOREIGN KEY ("daily_book_id") REFERENCES "public"."daily_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_positions" ADD CONSTRAINT "daily_book_positions_block_id_daily_book_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."daily_book_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_book_scenes" ADD CONSTRAINT "daily_book_scenes_daily_book_id_daily_books_id_fk" FOREIGN KEY ("daily_book_id") REFERENCES "public"."daily_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_agenda_event_id_agenda_events_id_fk" FOREIGN KEY ("agenda_event_id") REFERENCES "public"."agenda_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_scale_id_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."scales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_show_book_id_show_books_id_fk" FOREIGN KEY ("show_book_id") REFERENCES "public"."show_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_books" ADD CONSTRAINT "daily_books_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_decisions" ADD CONSTRAINT "request_decisions_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_decisions" ADD CONSTRAINT "request_decisions_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_operational_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."operational_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_confirmations" ADD CONSTRAINT "notice_confirmations_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_confirmations" ADD CONSTRAINT "notice_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_changes" ADD CONSTRAINT "operational_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_events" ADD CONSTRAINT "history_events_mo_id_operational_changes_id_fk" FOREIGN KEY ("mo_id") REFERENCES "public"."operational_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_events" ADD CONSTRAINT "history_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_log" ADD CONSTRAINT "security_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;