CREATE TABLE "ritual_capacity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"user_id" text NOT NULL,
	"week_start" text NOT NULL,
	"task_limit" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_capacity_week" UNIQUE("workspace_id","config_id","user_id","week_start"),
	CONSTRAINT "ritual_capacity_limit" CHECK ("ritual_capacity"."task_limit" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "ritual_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"rationale" text NOT NULL,
	"review_date" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_decision_status" CHECK ("ritual_decisions"."status" IN ('proposed','accepted','superseded'))
);
--> statement-breakpoint
CREATE TABLE "ritual_objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_objective_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_objective_dates" CHECK ("ritual_objectives"."end_date" >= "ritual_objectives"."start_date"),
	CONSTRAINT "ritual_objective_status" CHECK ("ritual_objectives"."status" IN ('active','closed'))
);
--> statement-breakpoint
CREATE TABLE "ritual_results" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"objective_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"unit" text NOT NULL,
	"baseline" double precision NOT NULL,
	"current_value" double precision NOT NULL,
	"target" double precision NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_result_range" CHECK (abs("ritual_results"."baseline") <= 1000000000 AND abs("ritual_results"."current_value") <= 1000000000 AND abs("ritual_results"."target") <= 1000000000 AND "ritual_results"."baseline" <> "ritual_results"."target")
);
--> statement-breakpoint
ALTER TABLE "ritual_capacity" ADD CONSTRAINT "ritual_capacity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_capacity" ADD CONSTRAINT "ritual_capacity_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_decisions" ADD CONSTRAINT "ritual_decisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_decisions" ADD CONSTRAINT "ritual_decisions_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_objectives" ADD CONSTRAINT "ritual_objectives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_objectives" ADD CONSTRAINT "ritual_objectives_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_results" ADD CONSTRAINT "ritual_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_results" ADD CONSTRAINT "ritual_results_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_results" ADD CONSTRAINT "ritual_results_workspace_id_config_id_objective_id_ritual_objectives_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","objective_id") REFERENCES "public"."ritual_objectives"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_capacity_config" ON "ritual_capacity" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_capacity_expiry" ON "ritual_capacity" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_decision_config" ON "ritual_decisions" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_decision_expiry" ON "ritual_decisions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_objective_config" ON "ritual_objectives" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_objective_expiry" ON "ritual_objectives" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_result_config" ON "ritual_results" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_result_expiry" ON "ritual_results" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_result_objective" ON "ritual_results" USING btree ("objective_id","created_at","id");