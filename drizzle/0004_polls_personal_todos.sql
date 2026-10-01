CREATE TABLE "ritual_ballots" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"poll_id" text NOT NULL,
	"user_id" text NOT NULL,
	"choice" integer NOT NULL,
	CONSTRAINT "ritual_ballot_once" UNIQUE("poll_id","user_id"),
	CONSTRAINT "ritual_ballot_choice" CHECK ("ritual_ballots"."choice" BETWEEN 0 AND 9)
);
--> statement-breakpoint
CREATE TABLE "ritual_polls" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"options" text[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" bigint,
	CONSTRAINT "ritual_poll_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_poll_status" CHECK ("ritual_polls"."status" IN ('open','closed')),
	CONSTRAINT "ritual_poll_options" CHECK (cardinality("ritual_polls"."options") BETWEEN 2 AND 10)
);
--> statement-breakpoint
CREATE TABLE "ritual_todos" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"user_id" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completed_at" bigint,
	CONSTRAINT "ritual_todo_status" CHECK ("ritual_todos"."status" IN ('open','done'))
);
--> statement-breakpoint
ALTER TABLE "ritual_ballots" ADD CONSTRAINT "ritual_ballots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_ballots" ADD CONSTRAINT "ritual_ballots_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_ballots" ADD CONSTRAINT "ritual_ballots_workspace_id_config_id_poll_id_ritual_polls_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","poll_id") REFERENCES "public"."ritual_polls"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_polls" ADD CONSTRAINT "ritual_polls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_polls" ADD CONSTRAINT "ritual_polls_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_todos" ADD CONSTRAINT "ritual_todos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_ballot_config" ON "ritual_ballots" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_ballot_expiry" ON "ritual_ballots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_ballot_poll" ON "ritual_ballots" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "ritual_poll_config" ON "ritual_polls" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_poll_expiry" ON "ritual_polls" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_todo_owner" ON "ritual_todos" USING btree ("workspace_id","user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_todo_expiry" ON "ritual_todos" USING btree ("expires_at");