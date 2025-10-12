/**
 * Campaigns Schema
 *
 * Contains 3 tables for campaign and resource management:
 * - campaigns: DevRel/marketing initiatives (unit of ROI calculation)
 * - budgets: Cost entries by campaign for ROI calculations
 * - resources: Objects that developers interact with (content, events, links)
 *
 * Key concepts:
 * - Campaigns are the primary unit for ROI analysis
 * - Budgets track all costs associated with a campaign
 * - Resources are trackable entities (blog posts, events, repos, etc.)
 */

import { pgTable, uuid, text, date, numeric, timestamp, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './admin';

/**
 * Campaigns Table
 *
 * DevRel/marketing initiatives for ROI tracking.
 *
 * Fields:
 * - campaign_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - name: Campaign name
 * - channel: Campaign channel ("event", "ad", "content", "community", etc.)
 * - start_date: Campaign start date (DATE type)
 * - end_date: Campaign end date (DATE type)
 * - budget_total: Total budget (reference value, actual costs tracked in budgets table)
 * - attributes: Custom attributes (UTM parameters, owner, region, etc.) as JSONB
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraint on (tenant_id, name) to prevent duplicate campaign names per tenant.
 */
export const campaigns = pgTable('campaigns', {
  campaignId: uuid('campaign_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  budgetTotal: numeric('budget_total'),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameUnique: unique('campaigns_tenant_name_unique').on(t.tenantId, t.name),
}));

/**
 * Budgets Table
 *
 * Cost entries associated with campaigns.
 * Used for ROI calculation.
 *
 * Fields:
 * - budget_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - campaign_id: Foreign key to campaigns (cascade delete)
 * - category: Cost category ("labor", "ad", "production", "venue", "tool", "other")
 * - amount: Cost amount (numeric for precise decimal handling)
 * - currency: Currency code (default "JPY")
 * - spent_at: Spending date (DATE type)
 * - source: Data source ("form", "api", "csv", "plugin")
 * - memo: Optional notes
 * - meta: Additional metadata as JSONB
 * - created_at: Record creation timestamp
 *
 * Indexes:
 * - (tenant_id, campaign_id) for querying budgets by campaign
 */
export const budgets = pgTable('budgets', {
  budgetId: uuid('budget_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.campaignId, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  amount: numeric('amount').notNull(),
  currency: text('currency').notNull().default('JPY'),
  spentAt: date('spent_at').notNull(),
  source: text('source'),
  memo: text('memo'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantCampaignIdx: index('idx_budgets_tenant_campaign').on(t.tenantId, t.campaignId),
}));

/**
 * Resources Table
 *
 * Trackable objects that developers interact with.
 * Examples: blog posts, events, videos, ads, repositories, links, forms, webinars.
 *
 * Fields:
 * - resource_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - category: Resource category ("event", "blog", "video", "ad", "repo", "link", "form", "webinar")
 * - group_key: Optional grouping key (e.g., event name, media name, campaign group)
 * - title: Resource title
 * - url: Resource URL
 * - external_id: External system ID (e.g., Connpass event ID)
 * - campaign_id: Optional foreign key to campaigns (set null on campaign delete)
 * - attributes: Custom attributes (language, region, topic, tags, etc.) as JSONB
 * - created_at/updated_at: Timestamp tracking
 *
 * Indexes:
 * - (tenant_id, category) for filtering resources by category
 * - (tenant_id, campaign_id) for filtering resources by campaign
 */
export const resources = pgTable('resources', {
  resourceId: uuid('resource_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  groupKey: text('group_key'),
  title: text('title'),
  url: text('url'),
  externalId: text('external_id'),
  campaignId: uuid('campaign_id').references(() => campaigns.campaignId, { onDelete: 'set null' }),
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantCatIdx: index('idx_resources_tenant_cat').on(t.tenantId, t.category),
  tenantCampaignIdx: index('idx_resources_tenant_campaign').on(t.tenantId, t.campaignId),
}));
