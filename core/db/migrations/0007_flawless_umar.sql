CREATE TABLE "activity_types" (
	"activity_type_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tenant_id" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"icon_name" varchar(255) DEFAULT 'heroicons:bolt' NOT NULL,
	"color_class" varchar(255) DEFAULT 'text-gray-600 bg-gray-100 border-gray-200' NOT NULL,
	"stage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_types_tenant_action_unique" UNIQUE("tenant_id","action")
);
--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_stage_key_funnel_stages_stage_key_fk" FOREIGN KEY ("stage_key") REFERENCES "public"."funnel_stages"("stage_key") ON DELETE set null ON UPDATE no action;