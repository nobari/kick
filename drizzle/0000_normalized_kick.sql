CREATE TYPE "public"."installation_environment" AS ENUM('production', 'test');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recognition_kind" AS ENUM('kudos', 'coin');--> statement-breakpoint
CREATE TABLE "channel_members" (
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_members_workspace_id_channel_id_user_id_pk" PRIMARY KEY("workspace_id","channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"name" text,
	"is_private" boolean,
	"is_archived" boolean DEFAULT false NOT NULL,
	"purpose" text,
	"topic" text,
	"refreshed_at" timestamp with time zone,
	"membership_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_workspace_id_channel_id_pk" PRIMARY KEY("workspace_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "enterprises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text,
	"enterprise_id" text,
	"is_enterprise" boolean DEFAULT false NOT NULL,
	"environment" "installation_environment" DEFAULT 'production' NOT NULL,
	"app_id" text,
	"bot_id" text,
	"bot_user_id" text,
	"installer_user_id" text,
	"bot_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"user_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"credentials_ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"legacy_source" text,
	CONSTRAINT "slack_installations_legacy_source_unique" UNIQUE("legacy_source"),
	CONSTRAINT "installation_scope_valid" CHECK (("slack_installations"."is_enterprise" AND "slack_installations"."enterprise_id" IS NOT NULL AND "slack_installations"."workspace_id" IS NULL) OR (NOT "slack_installations"."is_enterprise" AND "slack_installations"."workspace_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "legacy_metric_baselines" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"metric" text NOT NULL,
	"dimension" text NOT NULL,
	"value" bigint NOT NULL,
	"as_of" timestamp with time zone,
	CONSTRAINT "legacy_metric_baselines_workspace_id_user_id_metric_dimension_pk" PRIMARY KEY("workspace_id","user_id","metric","dimension")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"username" text,
	"display_name" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "migration_records" (
	"run_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"source_hash" text NOT NULL,
	"disposition" text NOT NULL,
	"target_table" text,
	"target_id" text,
	CONSTRAINT "migration_records_run_id_source_path_pk" PRIMARY KEY("run_id","source_path"),
	CONSTRAINT "migration_disposition_valid" CHECK ("migration_records"."disposition" IN ('imported', 'derived', 'archived', 'quarantined'))
);
--> statement-breakpoint
CREATE TABLE "migration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_project" text NOT NULL,
	"snapshot_digest" text NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"source_count" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "migration_runs_snapshot_digest_unique" UNIQUE("snapshot_digest")
);
--> statement-breakpoint
CREATE TABLE "outbox_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"operation" text NOT NULL,
	"payload_ciphertext" text NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_owner" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "outbox_attempts_nonnegative" CHECK ("outbox_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pick_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"purpose" text,
	"question" text,
	"requested_count" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"message_ts" text,
	"legacy_source" text,
	CONSTRAINT "pick_events_legacy_source_unique" UNIQUE("legacy_source"),
	CONSTRAINT "pick_tenant_idx" UNIQUE("workspace_id","id"),
	CONSTRAINT "pick_count_positive" CHECK ("pick_events"."requested_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "pick_participants" (
	"workspace_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"selected_position" integer,
	CONSTRAINT "pick_participants_workspace_id_event_id_user_id_pk" PRIMARY KEY("workspace_id","event_id","user_id"),
	CONSTRAINT "pick_position_nonnegative" CHECK ("pick_participants"."selected_position" IS NULL OR "pick_participants"."selected_position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "processed_requests" (
	"workspace_id" text NOT NULL,
	"request_key" text NOT NULL,
	"status" "job_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"result_id" uuid,
	CONSTRAINT "processed_requests_workspace_id_request_key_pk" PRIMARY KEY("workspace_id","request_key")
);
--> statement-breakpoint
CREATE TABLE "recognition_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"kind" "recognition_kind" NOT NULL,
	"reason" text,
	"standup_id" uuid,
	"message_ts" text,
	"thread_ts" text,
	"permalink" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recognition_tenant_idx" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "recognition_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"recipient_id" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"legacy_source" text,
	CONSTRAINT "recognition_recipients_legacy_source_unique" UNIQUE("legacy_source"),
	CONSTRAINT "recognition_positive_units" CHECK ("recognition_recipients"."units" > 0)
);
--> statement-breakpoint
CREATE TABLE "standup_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_ts" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "standup_thread_tenant_idx" UNIQUE("workspace_id","channel_id","id")
);
--> statement-breakpoint
CREATE TABLE "standup_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_id" uuid,
	"user_id" text NOT NULL,
	"mood" text,
	"previous_work" text,
	"planned_work" text,
	"blockers" text,
	"submitted_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_ts" text NOT NULL,
	"permalink" text,
	"legacy_source" text,
	CONSTRAINT "standup_updates_legacy_source_unique" UNIQUE("legacy_source"),
	CONSTRAINT "standup_update_tenant_idx" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_workspace_id_category_name_pk" PRIMARY KEY("workspace_id","category","name")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"enterprise_id" text,
	"name" text,
	"domain" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_workspace_id_channel_id_channels_workspace_id_channel_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."channels"("workspace_id","channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_workspace_id_user_id_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_installations" ADD CONSTRAINT "slack_installations_enterprise_id_enterprises_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_metric_baselines" ADD CONSTRAINT "legacy_metric_baselines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_run_id_migration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."migration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_events" ADD CONSTRAINT "pick_events_workspace_id_channel_id_channels_workspace_id_channel_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."channels"("workspace_id","channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_events" ADD CONSTRAINT "pick_events_workspace_id_requested_by_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","requested_by") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_participants" ADD CONSTRAINT "pick_participants_workspace_id_event_id_pick_events_workspace_id_id_fk" FOREIGN KEY ("workspace_id","event_id") REFERENCES "public"."pick_events"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_participants" ADD CONSTRAINT "pick_participants_workspace_id_user_id_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_requests" ADD CONSTRAINT "processed_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_workspace_id_channel_id_channels_workspace_id_channel_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."channels"("workspace_id","channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_workspace_id_sender_id_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","sender_id") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_workspace_id_standup_id_standup_updates_workspace_id_id_fk" FOREIGN KEY ("workspace_id","standup_id") REFERENCES "public"."standup_updates"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_recipients" ADD CONSTRAINT "recognition_recipients_workspace_id_event_id_recognition_events_workspace_id_id_fk" FOREIGN KEY ("workspace_id","event_id") REFERENCES "public"."recognition_events"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_recipients" ADD CONSTRAINT "recognition_recipients_workspace_id_recipient_id_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","recipient_id") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_threads" ADD CONSTRAINT "standup_threads_workspace_id_channel_id_channels_workspace_id_channel_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."channels"("workspace_id","channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_updates" ADD CONSTRAINT "standup_updates_workspace_id_channel_id_channels_workspace_id_channel_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."channels"("workspace_id","channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_updates" ADD CONSTRAINT "standup_updates_workspace_id_user_id_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_updates" ADD CONSTRAINT "standup_updates_workspace_id_channel_id_thread_id_standup_threads_workspace_id_channel_id_id_fk" FOREIGN KEY ("workspace_id","channel_id","thread_id") REFERENCES "public"."standup_threads"("workspace_id","channel_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_enterprise_id_enterprises_id_fk" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_members_user_idx" ON "channel_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_workspace_installation_idx" ON "slack_installations" USING btree ("workspace_id","environment") WHERE "slack_installations"."revoked_at" IS NULL AND NOT "slack_installations"."is_enterprise";--> statement-breakpoint
CREATE UNIQUE INDEX "active_enterprise_installation_idx" ON "slack_installations" USING btree ("enterprise_id","environment") WHERE "slack_installations"."revoked_at" IS NULL AND "slack_installations"."is_enterprise";--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_dedup_idx" ON "outbox_jobs" USING btree ("workspace_id","deduplication_key");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_jobs" USING btree ("available_at","id") WHERE "outbox_jobs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_lease_idx" ON "outbox_jobs" USING btree ("lease_until") WHERE "outbox_jobs"."status" = 'processing';--> statement-breakpoint
CREATE UNIQUE INDEX "pick_message_idx" ON "pick_events" USING btree ("workspace_id","channel_id","message_ts");--> statement-breakpoint
CREATE INDEX "pick_report_idx" ON "pick_events" USING btree ("workspace_id","channel_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pick_selected_position_idx" ON "pick_participants" USING btree ("workspace_id","event_id","selected_position");--> statement-breakpoint
CREATE INDEX "pick_participant_history_idx" ON "pick_participants" USING btree ("workspace_id","user_id","event_id");--> statement-breakpoint
CREATE INDEX "request_expiry_idx" ON "processed_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recognition_message_idx" ON "recognition_events" USING btree ("workspace_id","channel_id","message_ts","kind","sender_id");--> statement-breakpoint
CREATE INDEX "recognition_report_idx" ON "recognition_events" USING btree ("workspace_id","kind","occurred_at","id");--> statement-breakpoint
CREATE INDEX "recognition_recipient_idx" ON "recognition_recipients" USING btree ("workspace_id","recipient_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_thread_message_idx" ON "standup_threads" USING btree ("workspace_id","channel_id","message_ts");--> statement-breakpoint
CREATE INDEX "standup_threads_recent_idx" ON "standup_threads" USING btree ("workspace_id","channel_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_update_message_idx" ON "standup_updates" USING btree ("workspace_id","channel_id","message_ts");--> statement-breakpoint
CREATE INDEX "standup_channel_report_idx" ON "standup_updates" USING btree ("workspace_id","channel_id","submitted_at","id");--> statement-breakpoint
CREATE INDEX "standup_member_recent_idx" ON "standup_updates" USING btree ("workspace_id","user_id","submitted_at","id");