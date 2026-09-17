CREATE TABLE "ritual_blockers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"reporter_id" text NOT NULL,
	"helper_id" text NOT NULL,
	"detail" text NOT NULL,
	"resolved_at" bigint,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "ritual_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"timezone" text NOT NULL,
	"checkin_time" text NOT NULL,
	"digest_time" text NOT NULL,
	"weekdays" integer[] NOT NULL,
	"participants" text[] NOT NULL,
	"template" text NOT NULL,
	"questions" text[] NOT NULL,
	"roundup" boolean DEFAULT false NOT NULL,
	"retention_days" integer NOT NULL,
	"next_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"lease_owner" text,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "ritual_config_channel" UNIQUE("workspace_id","channel_id"),
	CONSTRAINT "ritual_config_tenant" UNIQUE("workspace_id","id"),
	CONSTRAINT "ritual_retention_valid" CHECK ("ritual_configs"."retention_days" IN (7,30,90)),
	CONSTRAINT "ritual_participants_valid" CHECK (cardinality("ritual_configs"."participants") BETWEEN 1 AND 50),
	CONSTRAINT "ritual_questions_valid" CHECK (cardinality("ritual_configs"."questions") BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "ritual_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"timezone" text NOT NULL,
	"checkin_time" text NOT NULL,
	"digest_time" text NOT NULL,
	"weekdays" integer[] NOT NULL,
	"participants" text[] NOT NULL,
	"template" text NOT NULL,
	"questions" text[] NOT NULL,
	"roundup" boolean DEFAULT false NOT NULL,
	"retention_days" integer NOT NULL,
	"editor_id" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ritual_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"channel_id" text NOT NULL,
	"kind" text NOT NULL,
	"lease_owner" text,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"run_id" text,
	"user_id" text,
	"blocker_id" text,
	"since_at" bigint,
	"selected_user" text,
	"reason" text,
	"client_message_id" text NOT NULL,
	"due_at" bigint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	CONSTRAINT "ritual_job_kind" CHECK ("ritual_jobs"."kind" IN ('prompt','reminder','digest','roundup','followup','rotation')),
	CONSTRAINT "ritual_job_attempts" CHECK ("ritual_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ritual_prefs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"timezone" text,
	"quiet_start" text,
	"quiet_end" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"leave_until" text,
	"snooze_until" bigint,
	CONSTRAINT "ritual_pref_user" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ritual_recognition" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ritual_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answers" text[] NOT NULL,
	CONSTRAINT "ritual_response_user" UNIQUE("run_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ritual_rotations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"selected_user" text NOT NULL,
	"history" text[] NOT NULL,
	"operations" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ritual_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"channel_id" text NOT NULL,
	"local_date" text NOT NULL,
	"participants" text[] NOT NULL,
	"questions" text[] NOT NULL,
	CONSTRAINT "ritual_run_date" UNIQUE("config_id","local_date"),
	CONSTRAINT "ritual_run_tenant" UNIQUE("workspace_id","config_id","id")
);
--> statement-breakpoint
ALTER TABLE "ritual_blockers" ADD CONSTRAINT "ritual_blockers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_blockers" ADD CONSTRAINT "ritual_blockers_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_configs" ADD CONSTRAINT "ritual_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_drafts" ADD CONSTRAINT "ritual_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_jobs" ADD CONSTRAINT "ritual_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_jobs" ADD CONSTRAINT "ritual_jobs_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_prefs" ADD CONSTRAINT "ritual_prefs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_recognition" ADD CONSTRAINT "ritual_recognition_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_recognition" ADD CONSTRAINT "ritual_recognition_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD CONSTRAINT "ritual_responses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD CONSTRAINT "ritual_responses_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD CONSTRAINT "ritual_responses_workspace_id_config_id_run_id_ritual_runs_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","run_id") REFERENCES "public"."ritual_runs"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_rotations" ADD CONSTRAINT "ritual_rotations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_rotations" ADD CONSTRAINT "ritual_rotations_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_runs" ADD CONSTRAINT "ritual_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_runs" ADD CONSTRAINT "ritual_runs_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_blocker_config" ON "ritual_blockers" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_blocker_expiry" ON "ritual_blockers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_config_due" ON "ritual_configs" USING btree ("next_at","id") WHERE "ritual_configs"."enabled";--> statement-breakpoint
CREATE INDEX "ritual_draft_expiry" ON "ritual_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_job_config" ON "ritual_jobs" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_job_expiry" ON "ritual_jobs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_job_due" ON "ritual_jobs" USING btree ("due_at","id") WHERE NOT "ritual_jobs"."done";--> statement-breakpoint
CREATE INDEX "ritual_recognition_config" ON "ritual_recognition" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_recognition_expiry" ON "ritual_recognition" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_response_config" ON "ritual_responses" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_response_expiry" ON "ritual_responses" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_rotation_config" ON "ritual_rotations" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_rotation_expiry" ON "ritual_rotations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_run_config" ON "ritual_runs" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_run_expiry" ON "ritual_runs" USING btree ("expires_at");