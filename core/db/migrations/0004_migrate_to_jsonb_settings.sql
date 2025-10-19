-- Remove old individual columns and migrate to JSONB structure
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "fiscal_year_start";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "fiscal_year_end";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "smtp_host";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "smtp_port";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "smtp_username";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "smtp_password";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "ai_provider";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "ai_api_key";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "ai_model";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "s3_bucket";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "s3_region";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "s3_access_key_id";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "s3_secret_access_key";--> statement-breakpoint
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "s3_endpoint";--> statement-breakpoint

-- Add new columns with proper defaults
ALTER TABLE "system_settings" ALTER COLUMN "service_name" SET DEFAULT 'DevCle';--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "service_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Tokyo';--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "timezone" SET NOT NULL;--> statement-breakpoint

-- Add new fiscal_year_start_month column
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "fiscal_year_start_month" integer DEFAULT 4 NOT NULL;--> statement-breakpoint

-- Add new JSONB columns
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "s3_settings" jsonb;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "smtp_settings" jsonb;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "ai_settings" jsonb;--> statement-breakpoint

-- Add CHECK constraint for fiscal_year_start_month
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "fiscal_year_start_month_range";--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "fiscal_year_start_month_range" CHECK ("fiscal_year_start_month" >= 1 AND "fiscal_year_start_month" <= 12);
