-- Minimal initialization for ClickHouse used by PostHog in development.
-- Official deployment provides more complex configuration; this creates the database only.
CREATE DATABASE IF NOT EXISTS posthog;

