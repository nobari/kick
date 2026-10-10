ALTER TABLE "ritual_actions" ADD CONSTRAINT "ritual_action_tenant" UNIQUE("workspace_id","config_id","id");
--> statement-breakpoint
CREATE TABLE "ritual_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"connected_by" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_connection_provider" UNIQUE("workspace_id","provider"),
	CONSTRAINT "ritual_connection_tenant" UNIQUE("workspace_id","id"),
	CONSTRAINT "ritual_connection_provider_valid" CHECK ("ritual_connections"."provider" IN ('github','jira','linear'))
);
--> statement-breakpoint
CREATE TABLE "ritual_issuelinks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"mapping_id" text NOT NULL,
	"action_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"linked_by" text NOT NULL,
	"last_local_status" text NOT NULL,
	"last_remote_status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"synced_at" bigint NOT NULL,
	CONSTRAINT "ritual_issuelink_remote" UNIQUE("mapping_id","remote_id"),
	CONSTRAINT "ritual_issuelink_action" UNIQUE("action_id")
);
--> statement-breakpoint
CREATE TABLE "ritual_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"connection_id" text NOT NULL,
	"configured_by" text NOT NULL,
	"resource_id" text NOT NULL,
	"container_id" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "ritual_mapping_once" UNIQUE("workspace_id","config_id","connection_id"),
	CONSTRAINT "ritual_mapping_tenant" UNIQUE("workspace_id","config_id","id")
);
--> statement-breakpoint
CREATE TABLE "ritual_oauth" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"phase" text NOT NULL,
	"browser_hash" text,
	"encrypted_verifier" text,
	"used" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ritual_oauth_provider" CHECK ("ritual_oauth"."provider" IN ('github','jira','linear'))
);
--> statement-breakpoint
ALTER TABLE "ritual_connections" ADD CONSTRAINT "ritual_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_issuelinks" ADD CONSTRAINT "ritual_issuelinks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_issuelinks" ADD CONSTRAINT "ritual_issuelinks_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_issuelinks" ADD CONSTRAINT "ritual_issuelinks_workspace_id_config_id_mapping_id_ritual_mappings_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","mapping_id") REFERENCES "public"."ritual_mappings"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_issuelinks" ADD CONSTRAINT "ritual_issuelinks_workspace_id_config_id_action_id_ritual_actions_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","action_id") REFERENCES "public"."ritual_actions"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_mappings" ADD CONSTRAINT "ritual_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_mappings" ADD CONSTRAINT "ritual_mappings_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_mappings" ADD CONSTRAINT "ritual_mappings_workspace_id_connection_id_ritual_connections_workspace_id_id_fk" FOREIGN KEY ("workspace_id","connection_id") REFERENCES "public"."ritual_connections"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_oauth" ADD CONSTRAINT "ritual_oauth_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_oauth" ADD CONSTRAINT "ritual_oauth_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_connection_expiry" ON "ritual_connections" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_issuelink_config" ON "ritual_issuelinks" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_issuelink_expiry" ON "ritual_issuelinks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_mapping_config" ON "ritual_mappings" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_mapping_expiry" ON "ritual_mappings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_oauth_config" ON "ritual_oauth" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_oauth_expiry" ON "ritual_oauth" USING btree ("expires_at");
