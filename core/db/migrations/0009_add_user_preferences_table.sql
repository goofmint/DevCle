-- Migration: Add user_preferences table for Task 8.10
-- Purpose: Store per-user preferences like widget layout, theme, locale
--
-- Changes:
-- 1. Create user_preferences table
-- 2. Add unique constraint on (user_id, key)
-- 3. Enable RLS for tenant isolation

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "preference_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_id" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE cascade ON UPDATE no action;

-- Add unique constraint: one value per key per user
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_key_unique" UNIQUE("user_id","key");

-- Enable Row Level Security
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY user_preferences_tenant_isolation
  ON user_preferences
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::text);
