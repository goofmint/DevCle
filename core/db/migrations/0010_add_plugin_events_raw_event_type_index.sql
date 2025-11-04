-- Migration: Add event_type index to plugin_events_raw
-- Purpose: Improve query performance when filtering by event_type
-- Related: Task 8.11 - Plugin Data Collection API

CREATE INDEX IF NOT EXISTS "idx_plugin_events_raw_event_type" ON "plugin_events_raw" ("tenant_id", "plugin_id", "event_type");
