/**
 * Core Schema
 *
 * Contains 5 core entity tables for developer identity resolution:
 * - organizations: Organizations that developers belong to
 * - developers: Canonical developer entities (post-merge identity container)
 * - accounts: External service accounts (GitHub, Slack, X, Discord, etc.) - MOST IMPORTANT
 * - developer_identifiers: Non-account identifiers (email, domain, phone, mlid, click_id, key_fp)
 * - developer_merge_logs: Audit log for developer identity merges
 *
 * Key architecture:
 * - Developers are the "container" (器) that holds multiple accounts/identifiers
 * - Accounts track which external account performed which activity
 * - Confidence scoring (0.0-1.0) for automatic identity linking
 * - Deduplication via hash-based dedup_key
 */

import { pgTable, uuid, text, timestamp, jsonb, unique, boolean, numeric, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './admin';
import { users } from './admin';

/**
 * Organizations Table
 *
 * Organizations (companies, communities) that developers belong to.
 *
 * Fields:
 * - org_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - name: Organization name
 * - domain_primary: Primary domain (e.g., "example.com") - CITEXT in PostgreSQL
 * - attributes: Custom attributes (industry, size, etc.) as JSONB
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraint on (tenant_id, name) to prevent duplicate org names per tenant.
 */
export const organizations = pgTable('organizations', {
  orgId: uuid('org_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domainPrimary: text('domain_primary'), // CITEXT type in PostgreSQL
  attributes: jsonb('attributes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameUnique: unique('organizations_tenant_name_unique').on(t.tenantId, t.name),
}));

/**
 * Developers Table
 *
 * Canonical developer entity after identity resolution.
 * This is the "container" (器) that holds multiple accounts and identifiers.
 *
 * Fields:
 * - developer_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - display_name: Display name (may be null before resolution)
 * - primary_email: Primary email (may be null before resolution) - CITEXT in PostgreSQL
 * - org_id: Foreign key to organizations (set null on org delete)
 * - consent_analytics: Analytics consent flag (default true per schema.sql)
 * - tags: Category tags as text array
 * - created_at/updated_at: Timestamp tracking
 *
 * Indexes:
 * - (tenant_id, org_id) for filtering developers by organization
 *
 * Note: primary_email nullable because identity may not be resolved yet.
 */
export const developers = pgTable('developers', {
  developerId: uuid('developer_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  primaryEmail: text('primary_email'), // CITEXT type in PostgreSQL
  orgId: uuid('org_id').references(() => organizations.orgId, { onDelete: 'set null' }),
  consentAnalytics: boolean('consent_analytics').notNull().default(true),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailUnique: unique('developers_tenant_email_unique').on(t.tenantId, t.primaryEmail),
  tenantOrgIdx: index('idx_developers_tenant_org').on(t.tenantId, t.orgId),
}));

/**
 * Accounts Table (MOST IMPORTANT)
 *
 * External service accounts linked to developers.
 * This table is CRITICAL for tracking which account performed which activity.
 *
 * Fields:
 * - account_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - developer_id: Foreign key to developers (set null on developer delete, nullable before resolution)
 * - provider: Service provider ("github", "slack", "x", "discord", "email", "ga", "posthog", etc.)
 * - external_user_id: Provider-specific unique ID (e.g., GitHub user ID)
 * - handle: Username/handle on the provider (e.g., "@username")
 * - email: Account email - CITEXT in PostgreSQL
 * - profile_url: Link to profile on provider
 * - avatar_url: Avatar image URL
 * - first_seen/last_seen: Timestamp tracking for activity
 * - verified_at: Verification timestamp (e.g., email verified)
 * - is_primary: Whether this is the primary account for the developer
 * - confidence: Automatic linking confidence score (0.0-1.0, default 0.8)
 * - attributes: Custom attributes as JSONB
 * - dedup_key: Deduplication hash (unique) to prevent duplicates
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraints:
 * - (tenant_id, provider, external_user_id) to prevent duplicate accounts
 * - dedup_key for additional deduplication
 *
 * Indexes:
 * - (tenant_id, developer_id) for filtering accounts by developer
 */
export const accounts = pgTable('accounts', {
  accountId: uuid('account_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').references(() => developers.developerId, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  externalUserId: text('external_user_id').notNull(),
  handle: text('handle'),
  email: text('email'), // CITEXT type in PostgreSQL
  profileUrl: text('profile_url'),
  avatarUrl: text('avatar_url'),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  isPrimary: boolean('is_primary').notNull().default(false),
  confidence: numeric('confidence').notNull().default('0.8'),
  attributes: jsonb('attributes'),
  dedupKey: text('dedup_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerUserUnique: unique('accounts_tenant_provider_user_unique').on(t.tenantId, t.provider, t.externalUserId),
  tenantDevIdx: index('idx_accounts_tenant_dev').on(t.tenantId, t.developerId),
}));

/**
 * Developer Identifiers Table
 *
 * Non-account identifiers linked to developers.
 * Used for identity resolution via email, domain, phone, mlid, click_id, key fingerprint, etc.
 *
 * Fields:
 * - identifier_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - developer_id: Foreign key to developers (cascade delete)
 * - kind: Identifier type ("email", "domain", "phone", "mlid", "click_id", "key_fp")
 * - value_normalized: Normalized value (lowercased, etc.)
 * - confidence: Linking confidence score (0.0-1.0, default 1.0)
 * - attributes: Custom attributes as JSONB
 * - first_seen/last_seen: Timestamp tracking
 *
 * Unique constraint on (tenant_id, kind, value_normalized) to prevent duplicates.
 *
 * Indexes:
 * - (tenant_id, developer_id) for filtering identifiers by developer
 */
export const developerIdentifiers = pgTable('developer_identifiers', {
  identifierId: uuid('identifier_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  developerId: uuid('developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  valueNormalized: text('value_normalized').notNull(),
  confidence: numeric('confidence').notNull().default('1.0'),
  attributes: jsonb('attributes'),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
}, (t) => ({
  kindValueUnique: unique('dev_identifiers_tenant_kind_value_unique').on(t.tenantId, t.kind, t.valueNormalized),
  tenantDevIdx: index('idx_dev_identifiers_tenant_dev').on(t.tenantId, t.developerId),
}));

/**
 * Developer Merge Logs Table
 *
 * Audit log for developer identity merges.
 * Tracks when and why two developer profiles were merged.
 *
 * Fields:
 * - merge_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - into_developer_id: Target developer (merge destination) - Foreign key to developers (cascade delete)
 * - from_developer_id: Source developer (merge source) - Foreign key to developers (cascade delete)
 * - reason: Human-readable merge reason
 * - evidence: Matched attributes and confidence scores as JSONB
 * - merged_at: Merge timestamp (defaults to now)
 * - merged_by: User who performed the merge (foreign key to users, nullable for automatic merges)
 *
 * Note: OSS has minimal implementation, Cloud may have advanced audit features.
 */
export const developerMergeLogs = pgTable('developer_merge_logs', {
  mergeId: uuid('merge_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  intoDeveloperId: uuid('into_developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  fromDeveloperId: uuid('from_developer_id').notNull().references(() => developers.developerId, { onDelete: 'cascade' }),
  reason: text('reason'),
  evidence: jsonb('evidence'),
  mergedAt: timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),
  mergedBy: uuid('merged_by').references(() => users.userId),
});
