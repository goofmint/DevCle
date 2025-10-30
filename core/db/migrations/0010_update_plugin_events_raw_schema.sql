-- Migration: Update plugin_events_raw table schema for event processing
-- This migration updates the table to support event type classification,
-- processing status tracking, and error handling.

-- Drop existing unique constraint on dedup_key
ALTER TABLE "plugin_events_raw" DROP CONSTRAINT IF EXISTS "plugin_events_raw_dedup_key_unique";

-- Rename columns
ALTER TABLE "plugin_events_raw" RENAME COLUMN "raw_id" TO "event_id";
ALTER TABLE "plugin_events_raw" RENAME COLUMN "payload" TO "raw_data";
ALTER TABLE "plugin_events_raw" RENAME COLUMN "received_at" TO "ingested_at";

-- Drop dedup_key column (deduplication is handled at activity level)
ALTER TABLE "plugin_events_raw" DROP COLUMN IF EXISTS "dedup_key";

-- Add new columns
ALTER TABLE "plugin_events_raw" ADD COLUMN "event_type" text NOT NULL DEFAULT 'unknown';
ALTER TABLE "plugin_events_raw" ADD COLUMN "processed_at" timestamp with time zone;
ALTER TABLE "plugin_events_raw" ADD COLUMN "status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "plugin_events_raw" ADD COLUMN "error_message" text;

-- Remove default value from event_type (it was only for migration)
ALTER TABLE "plugin_events_raw" ALTER COLUMN "event_type" DROP DEFAULT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_plugin_events_raw_tenant_plugin_time"
  ON "plugin_events_raw" ("tenant_id", "plugin_id", "ingested_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_plugin_events_raw_tenant_plugin_status"
  ON "plugin_events_raw" ("tenant_id", "plugin_id", "status");
