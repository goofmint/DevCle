/**
 * Plugins Schema
 *
 * Contains 5 tables for plugin system and data import:
 * - plugins: Registered plugins with per-tenant configuration
 * - plugin_runs: Execution logs for plugin jobs (shown in admin UI)
 * - plugin_events_raw: Raw payload archive for traceability and replay
 * - import_jobs: Batch import process control with metrics for UI
 * - shortlinks: Short URLs / QR codes for click tracking and campaign attribution
 *
 * Key concepts:
 * - Plugins enable external service integrations (GA, PostHog, Slack, GitHub, X, Connpass, etc.)
 * - Plugin runs track execution status for monitoring
 * - Raw events are archived for replay/debugging
 * - Import jobs manage batch CSV/API imports
 * - Shortlinks enable click tracking and campaign attribution
 */

import { pgTable, uuid, text, boolean, timestamp, jsonb, unique, index, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './admin';
import { users } from './admin';
import { campaigns, resources } from './campaigns';

/**
 * Plugins Table
 *
 * Registered plugins with per-tenant configuration.
 *
 * Fields:
 * - plugin_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - key: Plugin key ("ga", "posthog", "slack", "github", "x", "connpass", etc.)
 * - name: Human-readable plugin name
 * - enabled: Whether plugin is enabled (default true)
 * - config: JSONB containing API keys, endpoints, routes, etc.
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraint on (tenant_id, key) to prevent duplicate plugins per tenant.
 *
 * Note: Sensitive data in config should be encrypted at application level.
 */
export const plugins = pgTable('plugins', {
  pluginId: uuid('plugin_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyUnique: unique('plugins_tenant_key_unique').on(t.tenantId, t.key),
}));

/**
 * Plugin Runs Table
 *
 * Execution logs for plugin jobs.
 * Displayed in admin UI for monitoring.
 *
 * Fields:
 * - run_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - plugin_id: Foreign key to plugins (cascade delete)
 * - job_name: Name of the job from plugin.json jobs[] (e.g., "sync", "cleanup")
 * - started_at: Job start timestamp (defaults to now)
 * - completed_at: Job completion timestamp
 * - status: Job status ("pending", "running", "success", "failed")
 * - events_processed: Number of events processed (default 0)
 * - error_message: Error message if failed
 * - metadata: JSONB containing cursor, retryCount, lastRunAt, etc.
 *
 * Indexes:
 * - (tenant_id, plugin_id, started_at DESC) for querying recent runs by plugin
 */
export const pluginRuns = pgTable('plugin_runs', {
  runId: uuid('run_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  jobName: text('job_name').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  eventsProcessed: integer('events_processed').notNull().default(0),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
}, (t) => ({
  tenantPluginTimeIdx: index('idx_plugin_runs_tenant_plugin_time').on(t.tenantId, t.pluginId, t.startedAt),
}));

/**
 * Plugin Events Raw Table
 *
 * Raw payload archive from plugins.
 * Used for traceability, debugging, and event replay.
 *
 * Fields:
 * - event_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - plugin_id: Foreign key to plugins (cascade delete)
 * - event_type: Event type classification (e.g., "github:pull_request", "slack:message")
 * - raw_data: Raw event/document as JSONB
 * - ingested_at: Timestamp when event was received (defaults to now)
 * - processed_at: Timestamp when event was processed (NULL = pending)
 * - status: Processing status ("pending", "processed", "failed")
 * - error_message: Error message if processing failed
 *
 * Indexes:
 * - (tenant_id, plugin_id, ingested_at DESC) for querying recent events by plugin
 * - (tenant_id, plugin_id, status) for filtering by status
 *
 * Note: This table can grow large. Consider archiving old data periodically.
 */
export const pluginEventsRaw = pgTable('plugin_events_raw', {
  eventId: uuid('event_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  pluginId: uuid('plugin_id').notNull().references(() => plugins.pluginId, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
}, (t) => ({
  tenantPluginTimeIdx: index('idx_plugin_events_raw_tenant_plugin_time').on(t.tenantId, t.pluginId, t.ingestedAt),
  tenantPluginStatusIdx: index('idx_plugin_events_raw_tenant_plugin_status').on(t.tenantId, t.pluginId, t.status),
}));

/**
 * Import Jobs Table
 *
 * Batch import process control and metrics.
 * Used for CSV imports, API bulk imports, and manual data entry.
 *
 * Fields:
 * - job_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - source: Import source ("csv", "api", "manual")
 * - status: Job status ("queued", "running", "success", "failed", "partial")
 * - file_path: File path if CSV stored locally
 * - metrics: JSONB containing processed/inserted/failed counts
 * - started_at: Job start timestamp
 * - finished_at: Job completion timestamp
 * - created_by: User who initiated the import (foreign key to users)
 *
 * Note: Displayed in admin UI for tracking import progress.
 */
export const importJobs = pgTable('import_jobs', {
  jobId: uuid('job_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  status: text('status').notNull().default('queued'),
  filePath: text('file_path'),
  metrics: jsonb('metrics'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.userId),
});

/**
 * Shortlinks Table
 *
 * Short URLs / QR codes for click tracking and campaign attribution.
 *
 * Fields:
 * - shortlink_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - key: Human/QR-friendly token (e.g., "abcd1234")
 * - target_url: Destination URL
 * - campaign_id: Optional foreign key to campaigns (set null on campaign delete)
 * - resource_id: Optional foreign key to resources (set null on resource delete)
 * - attributes: JSONB containing UTM parameters, medium, source, etc.
 * - created_at: Creation timestamp
 * - updated_at: Last updated timestamp (for tracking url/key changes)
 *
 * Unique constraint on (tenant_id, key) to prevent duplicate shortlink keys per tenant.
 *
 * Usage: When a shortlink is clicked, create an activity with the shortlink_id in metadata.
 */
export const shortlinks = pgTable('shortlinks', {
  shortlinkId: uuid('shortlink_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  targetUrl: text('target_url').notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  keyUnique: unique('shortlinks_tenant_key_unique').on(t.tenantId, t.key),
}));
