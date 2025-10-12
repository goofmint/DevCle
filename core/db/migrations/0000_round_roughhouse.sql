-- Enable PostgreSQL extensions required for DRM
-- uuid-ossp: UUID generation functions (uuid_generate_v4())
-- citext: Case-insensitive text type for emails and domains
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

--> statement-breakpoint
CREATE TABLE "api_keys" (
	"api_key_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"hashed_key" text NOT NULL,
	"scope" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"channel" text NOT NULL,
	"target" text,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"base_url" text,
	"smtp_settings" jsonb,
	"ai_settings" jsonb,
	"shortlink_domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'OSS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"password_hash" text,
	"auth_provider" text,
	"last_login_at" timestamp with time zone,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_email_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"account_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"developer_id" uuid,
	"provider" text NOT NULL,
	"external_user_id" text NOT NULL,
	"handle" text,
	"email" text,
	"profile_url" text,
	"avatar_url" text,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false NOT NULL,
	"confidence" numeric DEFAULT '0.8' NOT NULL,
	"attributes" jsonb,
	"dedup_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_dedup_key_unique" UNIQUE("dedup_key"),
	CONSTRAINT "accounts_tenant_provider_user_unique" UNIQUE("tenant_id","provider","external_user_id")
);
--> statement-breakpoint
CREATE TABLE "developer_identifiers" (
	"identifier_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"developer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value_normalized" text NOT NULL,
	"confidence" numeric DEFAULT '1.0' NOT NULL,
	"attributes" jsonb,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	CONSTRAINT "dev_identifiers_tenant_kind_value_unique" UNIQUE("tenant_id","kind","value_normalized")
);
--> statement-breakpoint
CREATE TABLE "developer_merge_logs" (
	"merge_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"into_developer_id" uuid NOT NULL,
	"from_developer_id" uuid NOT NULL,
	"reason" text,
	"evidence" jsonb,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"merged_by" uuid
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"developer_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"display_name" text,
	"primary_email" text,
	"org_id" uuid,
	"consent_analytics" boolean DEFAULT true NOT NULL,
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developers_tenant_email_unique" UNIQUE("tenant_id","primary_email")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"org_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"domain_primary" text,
	"attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"budget_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"category" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text DEFAULT 'JPY' NOT NULL,
	"spent_at" date NOT NULL,
	"source" text,
	"memo" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"campaign_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"channel" text,
	"start_date" date,
	"end_date" date,
	"budget_total" numeric,
	"attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"resource_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"category" text NOT NULL,
	"group_key" text,
	"title" text,
	"url" text,
	"external_id" text,
	"campaign_id" uuid,
	"attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"developer_id" uuid,
	"account_id" uuid,
	"anon_id" text,
	"resource_id" uuid,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"category" text,
	"group_key" text,
	"metadata" jsonb,
	"confidence" numeric DEFAULT '1.0' NOT NULL,
	"dedup_key" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "activity_campaigns" (
	"activity_campaign_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"activity_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"weight" numeric DEFAULT '1.0' NOT NULL,
	CONSTRAINT "activity_campaigns_tenant_activity_campaign_unique" UNIQUE("tenant_id","activity_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"job_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"file_path" text,
	"metrics" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "plugin_events_raw" (
	"raw_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"plugin_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedup_key" text,
	CONSTRAINT "plugin_events_raw_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "plugin_runs" (
	"run_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"plugin_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"plugin_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_tenant_key_unique" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "shortlinks" (
	"shortlink_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"target_url" text NOT NULL,
	"campaign_id" uuid,
	"resource_id" uuid,
	"attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shortlinks_tenant_key_unique" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "activity_funnel_map" (
	"tenant_id" text NOT NULL,
	"action" text NOT NULL,
	"stage_key" text NOT NULL,
	CONSTRAINT "activity_funnel_map_tenant_id_action_pk" PRIMARY KEY("tenant_id","action")
);
--> statement-breakpoint
CREATE TABLE "campaign_stats" (
	"campaign_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"actions_total" bigint DEFAULT 0 NOT NULL,
	"conversions" bigint DEFAULT 0 NOT NULL,
	"cost_total" numeric DEFAULT '0' NOT NULL,
	"roi_per_cost" numeric,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_stats" (
	"developer_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"last_action_at" timestamp with time zone,
	"total_actions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"attends" bigint DEFAULT 0 NOT NULL,
	"posts" bigint DEFAULT 0 NOT NULL,
	"stars" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_stages" (
	"stage_key" text PRIMARY KEY NOT NULL,
	"order_no" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "funnel_stages_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_developer_id_developers_developer_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("developer_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_identifiers" ADD CONSTRAINT "developer_identifiers_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_identifiers" ADD CONSTRAINT "developer_identifiers_developer_id_developers_developer_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("developer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_merge_logs" ADD CONSTRAINT "developer_merge_logs_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_merge_logs" ADD CONSTRAINT "developer_merge_logs_into_developer_id_developers_developer_id_fk" FOREIGN KEY ("into_developer_id") REFERENCES "public"."developers"("developer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_merge_logs" ADD CONSTRAINT "developer_merge_logs_from_developer_id_developers_developer_id_fk" FOREIGN KEY ("from_developer_id") REFERENCES "public"."developers"("developer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_merge_logs" ADD CONSTRAINT "developer_merge_logs_merged_by_users_user_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_org_id_organizations_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("org_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_developer_id_developers_developer_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("developer_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_accounts_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_resource_id_resources_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("resource_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_campaigns" ADD CONSTRAINT "activity_campaigns_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_campaigns" ADD CONSTRAINT "activity_campaigns_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("activity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_campaigns" ADD CONSTRAINT "activity_campaigns_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_events_raw" ADD CONSTRAINT "plugin_events_raw_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_events_raw" ADD CONSTRAINT "plugin_events_raw_plugin_id_plugins_plugin_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("plugin_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_runs" ADD CONSTRAINT "plugin_runs_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_runs" ADD CONSTRAINT "plugin_runs_plugin_id_plugins_plugin_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("plugin_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlinks" ADD CONSTRAINT "shortlinks_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlinks" ADD CONSTRAINT "shortlinks_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortlinks" ADD CONSTRAINT "shortlinks_resource_id_resources_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("resource_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_funnel_map" ADD CONSTRAINT "activity_funnel_map_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_funnel_map" ADD CONSTRAINT "activity_funnel_map_stage_key_funnel_stages_stage_key_fk" FOREIGN KEY ("stage_key") REFERENCES "public"."funnel_stages"("stage_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_stats" ADD CONSTRAINT "campaign_stats_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_stats" ADD CONSTRAINT "campaign_stats_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_stats" ADD CONSTRAINT "developer_stats_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_tenant_dev" ON "accounts" USING btree ("tenant_id","developer_id");--> statement-breakpoint
CREATE INDEX "idx_dev_identifiers_tenant_dev" ON "developer_identifiers" USING btree ("tenant_id","developer_id");--> statement-breakpoint
CREATE INDEX "idx_developers_tenant_org" ON "developers" USING btree ("tenant_id","org_id");--> statement-breakpoint
CREATE INDEX "idx_budgets_tenant_campaign" ON "budgets" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_resources_tenant_cat" ON "resources" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "idx_resources_tenant_campaign" ON "resources" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_time" ON "activities" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_dev" ON "activities" USING btree ("tenant_id","developer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_res" ON "activities" USING btree ("tenant_id","resource_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_action" ON "activities" USING btree ("tenant_id","action","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_plugin_runs_tenant_plugin_time" ON "plugin_runs" USING btree ("tenant_id","plugin_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_dev_stats_tenant" ON "developer_stats" USING btree ("tenant_id");