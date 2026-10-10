CREATE TABLE "ritual_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"decision_note" text,
	"decided_at" bigint,
	CONSTRAINT "ritual_approval_status" CHECK ("ritual_approvals"."status" IN ('pending','approved','declined','cancelled')),
	CONSTRAINT "ritual_approval_separation" CHECK ("ritual_approvals"."creator_id" <> "ritual_approvals"."owner_id")
);
--> statement-breakpoint
CREATE TABLE "ritual_escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"editor_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"age_days" integer DEFAULT 2 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_escalation_once" UNIQUE("workspace_id","config_id"),
	CONSTRAINT "ritual_escalation_age" CHECK ("ritual_escalations"."age_days" BETWEEN 1 AND 30)
);
--> statement-breakpoint
CREATE TABLE "ritual_handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"target_config_id" text NOT NULL,
	CONSTRAINT "ritual_handoff_target_differs" CHECK ("ritual_handoffs"."config_id" <> "ritual_handoffs"."target_config_id"),
	CONSTRAINT "ritual_handoff_status" CHECK ("ritual_handoffs"."status" IN ('pending','accepted','completed','declined','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "ritual_leaves" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"cover_id" text NOT NULL,
	"decision_note" text,
	"decided_at" bigint,
	CONSTRAINT "ritual_leave_dates" CHECK ("ritual_leaves"."start_date" <= "ritual_leaves"."end_date"),
	CONSTRAINT "ritual_leave_status" CHECK ("ritual_leaves"."status" IN ('pending','approved','declined','cancelled')),
	CONSTRAINT "ritual_leave_separation" CHECK ("ritual_leaves"."creator_id" <> "ritual_leaves"."owner_id" AND "ritual_leaves"."creator_id" <> "ritual_leaves"."cover_id")
);
--> statement-breakpoint
CREATE TABLE "ritual_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"encrypted_title" text NOT NULL,
	"meeting_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_meeting_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_meeting_pair" CHECK ("ritual_meetings"."creator_id" <> "ritual_meetings"."partner_id"),
	CONSTRAINT "ritual_meeting_status" CHECK ("ritual_meetings"."status" IN ('active','completed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "ritual_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"meeting_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"assignee_id" text NOT NULL,
	"encrypted_detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_note_status" CHECK ("ritual_notes"."status" IN ('open','done'))
);
--> statement-breakpoint
CREATE TABLE "ritual_onboarding" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"creator_id" text NOT NULL,
	"newcomer_id" text NOT NULL,
	"buddy_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_onboarding_tenant" UNIQUE("workspace_id","config_id","id"),
	CONSTRAINT "ritual_onboarding_status" CHECK ("ritual_onboarding"."status" IN ('active','completed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "ritual_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"config_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"onboarding_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"assignee_id" text NOT NULL,
	"detail" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ritual_step_status" CHECK ("ritual_steps"."status" IN ('open','done'))
);
--> statement-breakpoint
ALTER TABLE "ritual_approvals" ADD CONSTRAINT "ritual_approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_approvals" ADD CONSTRAINT "ritual_approvals_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_escalations" ADD CONSTRAINT "ritual_escalations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_escalations" ADD CONSTRAINT "ritual_escalations_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_handoffs" ADD CONSTRAINT "ritual_handoffs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_handoffs" ADD CONSTRAINT "ritual_handoffs_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_handoffs" ADD CONSTRAINT "ritual_handoffs_workspace_id_target_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","target_config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_leaves" ADD CONSTRAINT "ritual_leaves_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_leaves" ADD CONSTRAINT "ritual_leaves_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_meetings" ADD CONSTRAINT "ritual_meetings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_meetings" ADD CONSTRAINT "ritual_meetings_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_notes" ADD CONSTRAINT "ritual_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_notes" ADD CONSTRAINT "ritual_notes_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_notes" ADD CONSTRAINT "ritual_notes_workspace_id_config_id_meeting_id_ritual_meetings_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","meeting_id") REFERENCES "public"."ritual_meetings"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_onboarding" ADD CONSTRAINT "ritual_onboarding_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_onboarding" ADD CONSTRAINT "ritual_onboarding_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_steps" ADD CONSTRAINT "ritual_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_steps" ADD CONSTRAINT "ritual_steps_workspace_id_config_id_ritual_configs_workspace_id_id_fk" FOREIGN KEY ("workspace_id","config_id") REFERENCES "public"."ritual_configs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ritual_steps" ADD CONSTRAINT "ritual_steps_workspace_id_config_id_onboarding_id_ritual_onboarding_workspace_id_config_id_id_fk" FOREIGN KEY ("workspace_id","config_id","onboarding_id") REFERENCES "public"."ritual_onboarding"("workspace_id","config_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ritual_approval_config" ON "ritual_approvals" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_approval_expiry" ON "ritual_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_approval_inbox" ON "ritual_approvals" USING btree ("workspace_id","owner_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ritual_escalation_config" ON "ritual_escalations" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_escalation_expiry" ON "ritual_escalations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_handoff_config" ON "ritual_handoffs" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_handoff_expiry" ON "ritual_handoffs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_handoff_target" ON "ritual_handoffs" USING btree ("workspace_id","target_config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_leave_config" ON "ritual_leaves" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_leave_expiry" ON "ritual_leaves" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_leave_coverage" ON "ritual_leaves" USING btree ("workspace_id","config_id","status","start_date","end_date");--> statement-breakpoint
CREATE INDEX "ritual_meeting_config" ON "ritual_meetings" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_meeting_expiry" ON "ritual_meetings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_meeting_participants" ON "ritual_meetings" USING btree ("workspace_id","creator_id","partner_id","created_at");--> statement-breakpoint
CREATE INDEX "ritual_note_config" ON "ritual_notes" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_note_expiry" ON "ritual_notes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_note_parent" ON "ritual_notes" USING btree ("meeting_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_onboarding_config" ON "ritual_onboarding" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_onboarding_expiry" ON "ritual_onboarding" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_step_config" ON "ritual_steps" USING btree ("config_id","created_at","id");--> statement-breakpoint
CREATE INDEX "ritual_step_expiry" ON "ritual_steps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ritual_step_parent" ON "ritual_steps" USING btree ("onboarding_id","created_at","id");