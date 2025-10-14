/**
 * Activities Schema
 *
 * Contains 2 tables for activity tracking and attribution:
 * - activities: Event log (who did what to which resource and when) - MOST IMPORTANT
 * - activity_campaigns: N:M mapping for multi-touch attribution with weights
 *
 * Key concepts:
 * - Activities track all developer actions (click, attend, post, view, signup, etc.)
 * - account_id field is CRITICAL for tracking which account performed the action
 * - activity_campaigns enables multi-touch attribution across campaigns
 */

import { pgTable, uuid, text, timestamp, numeric, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './admin';
import { developers, accounts } from './core';
import { resources } from './campaigns';
import { campaigns } from './campaigns';

/**
 * Activities Table (MOST IMPORTANT)
 *
 * Event log tracking all developer/account actions.
 * This is the heart of the analytics system.
 *
 * Fields:
 * - activity_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - developer_id: Foreign key to developers (set null on delete, nullable before identity resolution)
 * - account_id: Which account performed this action (CRITICAL FIELD) - Foreign key to accounts (set null on delete)
 * - anon_id: Anonymous ID for unidentified users (click_id, QR code, etc.)
 * - resource_id: Foreign key to resources (set null on delete)
 * - action: Action type ("click", "attend", "post", "view", "comment", "signup", "download", "api_call", etc.)
 * - occurred_at: When the action actually happened (TIMESTAMPTZ)
 * - recorded_at: When we recorded this action (defaults to now)
 * - source: Data source ("ga", "posthog", "connpass", "x", "github", "csv", "form", "api")
 * - source_ref: Source-side ID or URL for reference
 * - category: Cached resource.category for query optimization (denormalized)
 * - group_key: Cached resource.group_key for query optimization (denormalized)
 * - metadata: JSONB containing user agent, language, UTM params, device, geo, shortlink_id, etc.
 * - confidence: Data confidence score (0.0-1.0, default 1.0)
 * - dedup_key: Deduplication hash (unique) to prevent duplicate events
 * - ingested_at: When this record was ingested (defaults to now)
 *
 * Indexes:
 * - (tenant_id, occurred_at DESC) for time-series queries
 * - (tenant_id, developer_id, occurred_at DESC) for per-developer activity
 * - (tenant_id, resource_id, occurred_at DESC) for per-resource activity
 * - (tenant_id, action, occurred_at DESC) for per-action queries
 * - GIN index on metadata for JSONB queries (must be added manually in migration)
 *
 * Note: The account_id field is essential for tracking which external account
 * (GitHub, Slack, X, etc.) performed the action, enabling proper attribution.
 */
export const activities = pgTable('activities', {
  activityId: uuid('activity_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.accountId, { onDelete: 'set null' }),
  anonId: text('anon_id'),
  resourceId: uuid('resource_id').references(() => resources.resourceId, { onDelete: 'set null' }),
  action: text('action').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  category: text('category'),
  groupKey: text('group_key'),
  metadata: jsonb('metadata'),
  confidence: numeric('confidence').notNull().default('1.0'),
  value: numeric('value'), // Monetary value of this activity for ROI calculation (nullable)
  dedupKey: text('dedup_key').unique(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantTimeIdx: index('idx_activities_tenant_time').on(t.tenantId, t.occurredAt),
  tenantDevIdx: index('idx_activities_tenant_dev').on(t.tenantId, t.developerId, t.occurredAt),
  tenantResIdx: index('idx_activities_tenant_res').on(t.tenantId, t.resourceId, t.occurredAt),
  tenantActionIdx: index('idx_activities_tenant_action').on(t.tenantId, t.action, t.occurredAt),
}));

// Note: GIN index on metadata must be added manually in migration SQL:
// CREATE INDEX idx_activities_metadata_gin ON activities USING GIN (metadata);

/**
 * Activity Campaigns Table
 *
 * N:M mapping between activities and campaigns for multi-touch attribution.
 * Allows one activity to be attributed to multiple campaigns with different weights.
 *
 * Fields:
 * - activity_campaign_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - activity_id: Foreign key to activities (cascade delete)
 * - campaign_id: Foreign key to campaigns (cascade delete)
 * - weight: Attribution weight (0.0-1.0, default 1.0)
 *
 * Unique constraint on (tenant_id, activity_id, campaign_id) to prevent duplicate mappings.
 *
 * Example: If an activity is influenced by 2 campaigns, each could get weight 0.5
 * for equal attribution, or different weights for first-touch/last-touch models.
 */
export const activityCampaigns = pgTable('activity_campaigns', {
  activityCampaignId: uuid('activity_campaign_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  activityId: uuid('activity_id').notNull().references(() => activities.activityId, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  weight: numeric('weight').notNull().default('1.0'),
}, (t) => ({
  activityCampaignUnique: unique('activity_campaigns_tenant_activity_campaign_unique').on(t.tenantId, t.activityId, t.campaignId),
}));
