-- Add logo_url column
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "logo_url" text;
