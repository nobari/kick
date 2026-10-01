CREATE TABLE "ritual_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"assignee_id" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" bigint,
	"source_kind" text,
	"source_id" text,
	"sprint_id" text,
	CONSTRAINT "ritual_action_status" CHECK ("ritual_actions"."status" IN ('open','done'))
);
--> statement-breakpoint
CREATE TABLE "ritual_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"actor_id" text NOT NULL,
	"event" text NOT NULL,
	"target_id" text NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ritual_calendar" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"editor_id" text NOT NULL,
	"local_date" text NOT NULL,
	"skip" boolean NOT NULL,
	"checkin_time" text,
	"digest_time" text,
	CONSTRAINT "ritual_calendar_date" UNIQUE("config_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "ritual_estimates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"poker_id" text NOT NULL,
	"user_id" text NOT NULL,
	"round" integer NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "ritual_estimate_once" UNIQUE("poker_id","round","user_id"),
	CONSTRAINT "ritual_estimate_value" CHECK ("ritual_estimates"."value" IN ('0','1','2','3','5','8','13','21','?','abstain'))
);
--> statement-breakpoint
CREATE TABLE "ritual_poker" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'voting' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"participants" text[] NOT NULL,
	"decision" text,
	CONSTRAINT "ritual_poker_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_poker_status" CHECK ("ritual_poker"."status" IN ('voting','revealed','closed'))
);
--> statement-breakpoint
CREATE TABLE "ritual_retros" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	CONSTRAINT "ritual_retro_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_retro_status" CHECK ("ritual_retros"."status" IN ('collecting','voting','closed'))
);
--> statement-breakpoint
CREATE TABLE "ritual_sprints" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"recap" text,
	CONSTRAINT "ritual_sprint_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_sprint_status" CHECK ("ritual_sprints"."status" IN ('active','closed'))
);
--> statement-breakpoint
CREATE TABLE "ritual_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"retro_id" text NOT NULL,
	"author_id" text NOT NULL,
	"detail" text NOT NULL,
	"category" text NOT NULL,
	"group_name" text,
	CONSTRAINT "ritual_topic_tenant" UNIQUE("workspace_id","config_id","id")
);
--> statement-breakpoint
CREATE TABLE "ritual_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "ritual_vote_once" UNIQUE("topic_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "ritual_configs" DROP CONSTRAINT "ritual_config_channel";--> statement-breakpoint
ALTER TABLE "ritual_jobs" DROP CONSTRAINT "ritual_job_kind";--> statement-breakpoint
ALTER TABLE "ritual_configs" ADD COLUMN "name" text DEFAULT 'Daily standup' NOT NULL;--> statement-breakpoint
ALTER TABLE "ritual_configs" ADD COLUMN "workflow_key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "ritual_drafts" ADD COLUMN "name" text DEFAULT 'Daily standup' NOT NULL;--> statement-breakpoint
ALTER TABLE "ritual_drafts" ADD COLUMN "workflow_key" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD COLUMN "edited_at" bigint;--> statement-breakpoint
ALTER TABLE "ritual_responses" ADD COLUMN "correction" text;--> statement-breakpoint
ALTER TABLE "ritual_runs" ADD COLUMN "closes_at" bigint;--> statement-breakpoint
ALTER TABLE "ritual_actions" ADD CONSTRAINT "ritual_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_actions" ADD CONSTRAINT "ritual_actions_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_actions" ADD CONSTRAINT "ritual_actions_workspace_id_config_id_sprint_id_ritual_sprints_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","sprint_id") REFERENCES "public"."ritual_sprints"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_audit" ADD CONSTRAINT "ritual_audit_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_audit" ADD CONSTRAINT "ritual_audit_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_calendar" ADD CONSTRAINT "ritual_calendar_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_calendar" ADD CONSTRAINT "ritual_calendar_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_estimates" ADD CONSTRAINT "ritual_estimates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_estimates" ADD CONSTRAINT "ritual_estimates_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_estimates" ADD CONSTRAINT "ritual_estimates_workspace_id_config_id_poker_id_ritual_poker_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","poker_id") REFERENCES "public"."ritual_poker"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_poker" ADD CONSTRAINT "ritual_poker_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_poker" ADD CONSTRAINT "ritual_poker_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_retros" ADD CONSTRAINT "ritual_retros_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_retros" ADD CONSTRAINT "ritual_retros_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_sprints" ADD CONSTRAINT "ritual_sprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_sprints" ADD CONSTRAINT "ritual_sprints_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_topics" ADD CONSTRAINT "ritual_topics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_topics" ADD CONSTRAINT "ritual_topics_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_topics" ADD CONSTRAINT "ritual_topics_workspace_id_config_id_retro_id_ritual_retros_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","retro_id") REFERENCES "public"."ritual_retros"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_votes" ADD CONSTRAINT "ritual_votes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_votes" ADD CONSTRAINT "ritual_votes_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_votes" ADD CONSTRAINT "ritual_votes_workspace_id_config_id_topic_id_ritual_topics_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","topic_id") REFERENCES "public"."ritual_topics"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_action_config" ON "ritual_actions" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_action_expiry" ON "ritual_actions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_action_owner_due" ON "ritual_actions" USING btree ("workspace_id","assignee_id","status","due_date");--> statement-breakpoint
CREATE INDEX "ritual_audit_config" ON "ritual_audit" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_audit_expiry" ON "ritual_audit" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_calendar_config" ON "ritual_calendar" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_calendar_expiry" ON "ritual_calendar" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_estimate_config" ON "ritual_estimates" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_estimate_expiry" ON "ritual_estimates" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_poker_config" ON "ritual_poker" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_poker_expiry" ON "ritual_poker" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_retro_config" ON "ritual_retros" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_retro_expiry" ON "ritual_retros" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_sprint_config" ON "ritual_sprints" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_sprint_expiry" ON "ritual_sprints" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_topic_config" ON "ritual_topics" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_topic_expiry" ON "ritual_topics" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_vote_config" ON "ritual_votes" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_vote_expiry" ON "ritual_votes" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "ritual_configs" ADD CONSTRAINT "ritual_config_workflow" UNIQUE("workspace_id","channel_id","workflow_key");--> statement-breakpoint
ALTER TABLE "ritual_jobs" ADD CONSTRAINT "ritual_job_kind" CHECK ("ritual_jobs"."kind" IN ('prompt','reminder','digest','roundup','followup','rotation','notice'));