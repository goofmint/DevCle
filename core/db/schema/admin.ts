/**
 * Admin Schema
 *
 * Contains 5 core administrative tables for multi-tenant management:
 * - tenants: Top-level tenant management (OSS defaults to single-tenant)
 * - users: Console users who log into the dashboard
 * - api_keys: API keys for programmatic access (hashed values only)
 * - system_settings: Per-tenant settings (SMTP, AI, custom domains)
 * - notifications: Outbound notification history (email/slack/webhook)
 *
 * All tables include tenant_id for multi-tenant isolation via PostgreSQL RLS.
 */

import { pgTable, text, timestamp, uuid, boolean, jsonb, unique, integer, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { funnelStages } from './analytics';

/**
 * Tenants Table
 *
 * Root table for multi-tenant architecture.
 * OSS typically runs single-tenant with plan='OSS'.
 *
 * Fields:
 * - tenant_id: Primary key (text, not UUID for human-readable IDs)
 * - name: Tenant display name
 * - plan: Subscription plan (OSS by default, can be Standard/Pro/Enterprise)
 * - created_at/updated_at: Timestamp tracking
 */
export const tenants = pgTable('tenants', {
  tenantId: text('tenant_id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('OSS'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Users Table
 *
 * Console users who access the dashboard UI.
 * OSS has minimal features (no RBAC, no SSO).
 *
 * Fields:
 * - user_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - email: User email (treated as CITEXT in PostgreSQL for case-insensitive matching)
 * - display_name: Optional display name
 * - password_hash: Hashed password for local auth (bcrypt/argon2)
 * - auth_provider: Auth method ("password", "github", etc.)
 * - role: User role ("admin" or "member") for basic RBAC
 * - last_login_at: Last login timestamp
 * - disabled: User account disabled flag (default false)
 * - created_at/updated_at: Timestamp tracking
 *
 * Note: email is defined as text() here but should be CITEXT in PostgreSQL migration.
 * Unique constraint on (tenant_id, email) to prevent duplicate emails per tenant.
 */
export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  email: text('email').notNull(), // CITEXT type in PostgreSQL
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  authProvider: text('auth_provider'),
  role: text('role').notNull().default('member'), // "admin" or "member"
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Unique constraint: one email per tenant
  emailUnique: unique('users_tenant_email_unique').on(t.tenantId, t.email),
}));

/**
 * API Keys Table
 *
 * Stores API keys for programmatic access.
 * Only hashed values are stored (never plain text).
 *
 * Fields:
 * - api_key_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - name: Human-readable key name/description
 * - hashed_key: SHA-256 or similar hash of the actual key
 * - scope: Optional scope/permissions string
 * - created_by: Foreign key to users (who created this key)
 * - created_at: Creation timestamp
 * - revoked_at: NULL = active, non-NULL = revoked
 *
 * Security: Never store plain-text keys. Hash before insertion.
 */
export const apiKeys = pgTable('api_keys', {
  apiKeyId: uuid('api_key_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hashedKey: text('hashed_key').notNull(),
  scope: text('scope'),
  createdBy: uuid('created_by').references(() => users.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/**
 * System Settings Table
 *
 * Per-tenant configuration settings.
 * Stores service branding, integration settings, and custom domains.
 *
 * Fields:
 * - tenant_id: Primary key and foreign key to tenants (cascade delete)
 * - service_name: Tenant-specific service name (default: 'DevCle')
 * - logo_url: Logo image URL (S3 or external URL)
 * - fiscal_year_start_month: Fiscal year start month (1-12, default: 4 for April)
 * - timezone: IANA timezone (default: 'Asia/Tokyo')
 * - base_url: Base URL for this tenant's deployment
 * - s3_settings: JSONB containing S3 connection info (bucket, region, credentials)
 * - smtp_settings: JSONB containing SMTP connection info (host, port, user, pass)
 * - shortlink_domain: Custom domain for shortlinks (e.g., "go.example.com")
 * - created_at/updated_at: Timestamp tracking
 *
 * Note: AI settings removed from OSS version (moved to commercial plugins).
 * Note: Sensitive data in JSONB should be encrypted at application level.
 */
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull().default('DevCle'),
  logoUrl: text('logo_url'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(4),
  timezone: text('timezone').notNull().default('Asia/Tokyo'),
  baseUrl: text('base_url'),
  s3Settings: jsonb('s3_settings'),
  smtpSettings: jsonb('smtp_settings'),
  shortlinkDomain: text('shortlink_domain'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Notifications Table
 *
 * Outbound notification history (email, Slack, webhooks).
 * Optional feature in OSS.
 *
 * Fields:
 * - notification_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - channel: Notification channel ("email", "slack", "webhook")
 * - target: Recipient address/channel/webhook URL
 * - payload: JSONB containing notification content
 * - status: Delivery status ("queued", "sent", "failed")
 * - error_message: Error details if status = failed
 * - created_at: Queued timestamp
 * - sent_at: Actual delivery timestamp
 *
 * Use case: Track all outbound notifications for audit and retry logic.
 */
export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  target: text('target'),
  payload: jsonb('payload'),
  status: text('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

/**
 * Activity Types Table
 *
 * Defines customizable activity types with icons, colors, and funnel stage mapping.
 * Allows administrators to customize how different activity actions are displayed.
 *
 * Fields:
 * - activity_type_id: UUID primary key
 * - tenant_id: Foreign key to tenants (cascade delete)
 * - action: Action name (e.g., 'click', 'attend', 'signup', 'post', 'star')
 * - icon_name: Iconify icon name (e.g., 'heroicons:bolt', 'mdi:github')
 * - color_class: Tailwind CSS classes for styling (e.g., 'text-blue-600 bg-blue-100 border-blue-200')
 * - stage_key: Optional funnel stage mapping (references funnel_stages.stage_key)
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraint: (tenant_id, action) - one action per tenant
 *
 * Examples:
 * - action: 'click' → icon: 'heroicons:cursor-arrow-rays' → color: 'text-blue-600 bg-blue-100 border-blue-200'
 * - action: 'attend' → icon: 'heroicons:calendar-days' → color: 'text-green-600 bg-green-100 border-green-200'
 * - action: 'signup' → icon: 'heroicons:user-plus' → color: 'text-purple-600 bg-purple-100 border-purple-200'
 * - action: 'post' → icon: 'heroicons:chat-bubble-left-right' → color: 'text-orange-600 bg-orange-100 border-orange-200'
 * - action: 'star' → icon: 'heroicons:star' → color: 'text-yellow-600 bg-yellow-100 border-yellow-200'
 */
export const activityTypes = pgTable('activity_types', {
  activityTypeId: uuid('activity_type_id').primaryKey().default(sql`uuid_generate_v4()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),

  // Activity action (e.g., 'click', 'attend', 'signup', 'post', 'star')
  action: varchar('action', { length: 100 }).notNull(),

  // Iconify icon name (e.g., 'heroicons:bolt', 'mdi:github')
  iconName: varchar('icon_name', { length: 255 }).notNull().default('heroicons:bolt'),

  // Tailwind CSS classes for styling (e.g., 'text-blue-600 bg-blue-100 border-blue-200')
  colorClass: varchar('color_class', { length: 255 }).notNull().default('text-gray-600 bg-gray-100 border-gray-200'),

  // Optional funnel stage mapping (references funnel_stages.stage_key)
  stageKey: text('stage_key').references(() => funnelStages.stageKey, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Unique constraint: one action per tenant
  uniqueTenantAction: unique('activity_types_tenant_action_unique').on(t.tenantId, t.action),
}));

/**
 * User Preferences Table
 *
 * Stores per-user preferences like widget layout, theme, locale, etc.
 * Used for dashboard customization (Task 8.10).
 *
 * Fields:
 * - preference_id: UUID primary key
 * - user_id: Foreign key to users (cascade delete)
 * - tenant_id: Foreign key to tenants (cascade delete, for RLS)
 * - key: Preference key (e.g., 'widget_layout', 'theme', 'locale')
 * - value: JSONB value (flexible schema per key)
 * - created_at/updated_at: Timestamp tracking
 *
 * Unique constraint: (user_id, key) - one value per key per user
 *
 * Examples:
 * - key: 'widget_layout' → value: {"slot-1": "item-github-activities", "slot-2": "item-slack-messages"}
 * - key: 'theme' → value: "dark"
 * - key: 'locale' → value: "en"
 */
export const userPreferences = pgTable('user_preferences', {
  preferenceId: uuid('preference_id').primaryKey().default(sql`uuid_generate_v4()`),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Unique constraint: one value per key per user
  uniqueUserKey: unique('user_preferences_user_key_unique').on(t.userId, t.key),
}));
