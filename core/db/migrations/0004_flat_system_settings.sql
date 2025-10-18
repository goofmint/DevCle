-- Migration: Flatten SMTP/AI/S3 settings and add new columns to system_settings table
-- This migration drops the JSONB columns (smtp_settings, ai_settings) and replaces them
-- with individual columns for better query performance and schema clarity.

ALTER TABLE system_settings
  DROP COLUMN IF EXISTS smtp_settings,
  DROP COLUMN IF EXISTS ai_settings,
  ADD COLUMN service_name TEXT,
  ADD COLUMN logo_url TEXT,
  ADD COLUMN fiscal_year_start TEXT,
  ADD COLUMN fiscal_year_end TEXT,
  ADD COLUMN timezone TEXT,
  ADD COLUMN smtp_host TEXT,
  ADD COLUMN smtp_port INTEGER,
  ADD COLUMN smtp_username TEXT,
  ADD COLUMN smtp_password TEXT,
  ADD COLUMN ai_provider TEXT,
  ADD COLUMN ai_api_key TEXT,
  ADD COLUMN ai_model TEXT,
  ADD COLUMN s3_bucket TEXT,
  ADD COLUMN s3_region TEXT,
  ADD COLUMN s3_access_key_id TEXT,
  ADD COLUMN s3_secret_access_key TEXT,
  ADD COLUMN s3_endpoint TEXT;
