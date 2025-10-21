/**
 * Database Schema Index
 *
 * This file aggregates all database table schemas for the DevCle (DRM) project.
 * Total of 26 tables across 7 schema files:
 *
 * 1. admin.ts (6 tables):
 *    - tenants: Multi-tenant management
 *    - users: Console users (dashboard login)
 *    - api_keys: API keys for programmatic access
 *    - system_settings: Per-tenant settings (SMTP, AI, domains)
 *    - notifications: Outbound notification history
 *    - activity_types: Customizable activity types with icons, colors, and funnel stage mapping
 *
 * 2. core.ts (5 tables):
 *    - organizations: Organizations that developers belong to
 *    - developers: Canonical developer entities (post-merge identity container)
 *    - accounts: External service accounts (GitHub, Slack, X, Discord, etc.) - MOST IMPORTANT
 *    - developer_identifiers: Non-account identifiers (email, domain, phone, mlid, click_id, key_fp)
 *    - developer_merge_logs: Audit log for developer identity merges
 *
 * 3. campaigns.ts (3 tables):
 *    - campaigns: DevRel/marketing initiatives (unit of ROI calculation)
 *    - budgets: Cost entries by campaign
 *    - resources: Trackable objects (content, events, links)
 *
 * 4. activities.ts (2 tables):
 *    - activities: Event log (who did what to which resource and when)
 *    - activity_campaigns: N:M mapping for multi-touch attribution
 *
 * 5. plugins.ts (5 tables):
 *    - plugins: Registered plugins with per-tenant configuration
 *    - plugin_runs: Execution logs for plugin jobs
 *    - plugin_events_raw: Raw payload archive for traceability
 *    - import_jobs: Batch import process control
 *    - shortlinks: Short URLs / QR codes for click tracking
 *
 * 6. analytics.ts (4 tables):
 *    - developer_stats: Aggregated counters for developers (cache)
 *    - campaign_stats: Aggregated metrics per campaign (cache)
 *    - funnel_stages: Global funnel stage dictionary
 *    - activity_funnel_map: Per-tenant action-to-stage mapping
 *
 * 7. migrations.ts (1 table):
 *    - schema_migrations: Schema migration history
 *
 * All schemas are exported from this file and imported by:
 * - drizzle.config.ts: For migration generation
 * - db/connection.ts: For type-safe query building
 * - Application code: For data access
 *
 * Schema Design Principles:
 * - Every table includes tenant_id for RLS (Row Level Security)
 * - Timestamps: created_at, updated_at for audit trails
 * - UUIDs for primary keys (better for distributed systems)
 * - JSONB for flexible metadata storage
 * - Confidence scoring (0.0-1.0) for automatic identity linking
 * - Deduplication via hash-based dedup_key
 */

// Export all admin tables (6)
export * from './admin';

// Export all core entity tables (5)
export * from './core';

// Export all campaign/resource tables (3)
export * from './campaigns';

// Export all activity tables (2)
export * from './activities';

// Export all plugin/import tables (5)
export * from './plugins';

// Export all analytics/funnel tables (4)
export * from './analytics';

// Export system table (1)
export * from './migrations';
