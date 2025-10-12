/**
 * Analytics Schema
 *
 * Contains 4 tables for analytics caching and funnel mapping:
 * - developer_stats: Aggregated counters for developers (denormalized cache)
 * - campaign_stats: Aggregated metrics per campaign for dashboards
 * - funnel_stages: Global funnel stage dictionary (awareness, engagement, adoption, advocacy)
 * - activity_funnel_map: Per-tenant mapping from actions to funnel stages
 *
 * Key concepts:
 * - Stats tables are denormalized caches for query performance
 * - Funnel stages define the developer journey framework
 * - Activity funnel map allows per-tenant customization of action-to-stage mapping
 */

import { pgTable, uuid, text, timestamp, bigint, index, numeric, integer, primaryKey } from 'drizzle-orm/pg-core';
import { tenants } from './admin';
import { campaigns } from './campaigns';

/**
 * Developer Stats Table
 *
 * Aggregated counters for developers (denormalized cache).
 * Periodically recalculated from activities table for dashboard performance.
 *
 * Fields:
 * - developer_id: UUID primary key (also foreign key to developers, but not explicitly declared to avoid circular dependency)
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - last_action_at: Timestamp of most recent activity
 * - total_actions: Total number of actions
 * - clicks: Number of click actions
 * - attends: Number of attend actions
 * - posts: Number of post actions
 * - stars: Number of star actions (GitHub stars, etc.)
 * - updated_at: Cache update timestamp
 *
 * Indexes:
 * - (tenant_id) for filtering stats by tenant
 *
 * Note: This is a cache table. Values are recalculated from activities table.
 */
export const developerStats = pgTable('developer_stats', {
  developerId: uuid('developer_id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  lastActionAt: timestamp('last_action_at', { withTimezone: true }),
  totalActions: bigint('total_actions', { mode: 'number' }).notNull().default(0),
  clicks: bigint('clicks', { mode: 'number' }).notNull().default(0),
  attends: bigint('attends', { mode: 'number' }).notNull().default(0),
  posts: bigint('posts', { mode: 'number' }).notNull().default(0),
  stars: bigint('stars', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('idx_dev_stats_tenant').on(t.tenantId),
}));

/**
 * Campaign Stats Table
 *
 * Aggregated metrics per campaign for ROI calculation and dashboards.
 * Periodically recalculated from activities and budgets tables.
 *
 * Fields:
 * - campaign_id: UUID primary key and foreign key to campaigns (cascade delete)
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - actions_total: Total number of activities attributed to this campaign
 * - conversions: Number of conversion actions (signup, api_call, etc.)
 * - cost_total: Total cost from budgets table
 * - roi_per_cost: ROI per unit cost (calculated metric)
 * - updated_at: Cache update timestamp
 *
 * Note: This is a cache table. Values are recalculated from activities and budgets.
 */
export const campaignStats = pgTable('campaign_stats', {
  campaignId: uuid('campaign_id').primaryKey().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  actionsTotal: bigint('actions_total', { mode: 'number' }).notNull().default(0),
  conversions: bigint('conversions', { mode: 'number' }).notNull().default(0),
  costTotal: numeric('cost_total').notNull().default('0'),
  roiPerCost: numeric('roi_per_cost'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Funnel Stages Table
 *
 * Global funnel stage dictionary.
 * Defines the 4 standard stages of the developer journey.
 *
 * Fields:
 * - stage_key: Text primary key ("awareness", "engagement", "adoption", "advocacy")
 * - order_no: Stage order (1-4), unique
 * - title: Human-readable stage title
 *
 * Standard stages:
 * 1. Awareness: First contact with product/community
 * 2. Engagement: Active participation (posts, events, contributions)
 * 3. Adoption: Product usage, API calls
 * 4. Advocacy: Evangelism, content creation
 */
export const funnelStages = pgTable('funnel_stages', {
  stageKey: text('stage_key').primaryKey(),
  orderNo: integer('order_no').notNull().unique(),
  title: text('title').notNull(),
});

/**
 * Activity Funnel Map Table
 *
 * Per-tenant mapping from activity actions to funnel stages.
 * Allows customization of which actions map to which funnel stages.
 *
 * Fields:
 * - tenant_id: Foreign key to tenants (cascade delete), part of composite primary key
 * - action: Action name (e.g., "click", "attend", "signup"), part of composite primary key
 * - stage_key: Foreign key to funnel_stages
 *
 * Primary key: (tenant_id, action)
 *
 * Example mappings:
 * - "click" -> "awareness"
 * - "attend" -> "engagement"
 * - "signup" -> "adoption"
 * - "post" -> "advocacy"
 */
export const activityFunnelMap = pgTable('activity_funnel_map', {
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  stageKey: text('stage_key').notNull().references(() => funnelStages.stageKey),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.action] }),
}));
