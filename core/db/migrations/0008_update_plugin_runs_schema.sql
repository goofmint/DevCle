-- Migration: Update plugin_runs table schema for Task 8.8
-- Changes:
-- 1. Rename trigger → job_name (stores job name from plugin.json jobs[])
-- 2. Rename finished_at → completed_at (completion timestamp)
-- 3. Rename result → metadata (JSONB containing cursor, retryCount, etc.)
-- 4. Add events_processed column (integer, default 0)
-- 5. Add error_message column (text, nullable)
-- 6. Update status default from 'running' to 'pending'

-- Step 1: Rename columns
ALTER TABLE "plugin_runs" RENAME COLUMN "trigger" TO "job_name";
ALTER TABLE "plugin_runs" RENAME COLUMN "finished_at" TO "completed_at";
ALTER TABLE "plugin_runs" RENAME COLUMN "result" TO "metadata";

-- Step 2: Add new columns
ALTER TABLE "plugin_runs" ADD COLUMN "events_processed" integer NOT NULL DEFAULT 0;
ALTER TABLE "plugin_runs" ADD COLUMN "error_message" text;

-- Step 3: Update status column default value
ALTER TABLE "plugin_runs" ALTER COLUMN "status" SET DEFAULT 'pending';
