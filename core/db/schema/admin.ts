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

import { pgTable, text, timestamp, uuid, boolean, jsonb, unique, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
 * Stores all system-wide settings including basic config, SMTP, AI, and S3 settings.
 *
 * Fields:
 * - tenant_id: Primary key and foreign key to tenants (cascade delete)
 * - base_url: Base URL for this tenant's deployment
 * - shortlink_domain: Custom domain for shortlinks (e.g., "go.example.com")
 * - service_name: Custom service name (e.g., "DevCle")
 * - logo_url: Logo image URL (public URL or data URI)
 * - fiscal_year_start/end: Fiscal year boundaries (MM-DD format)
 * - timezone: IANA timezone (e.g., "Asia/Tokyo")
 * - smtp_*: SMTP server settings (flattened from JSONB)
 * - ai_*: AI provider settings (flattened from JSONB)
 * - s3_*: S3 storage settings (flattened from JSONB)
 * - created_at/updated_at: Timestamp tracking
 *
 * Note: Sensitive fields (smtp_password, ai_api_key, s3_secret_access_key)
 * must be encrypted at application level using AES-256-GCM.
 */
export const systemSettings = pgTable('system_settings', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.tenantId, { onDelete: 'cascade' }),
  baseUrl: text('base_url'),
  shortlinkDomain: text('shortlink_domain'),
  // Basic settings
  serviceName: text('service_name'),
  logoUrl: text('logo_url'),
  fiscalYearStart: text('fiscal_year_start'),
  fiscalYearEnd: text('fiscal_year_end'),
  timezone: text('timezone'),
  // SMTP settings (flattened)
  smtpHost: text('smtp_host'),
  smtpPort: integer('smtp_port'),
  smtpUsername: text('smtp_username'),
  smtpPassword: text('smtp_password'), // ENCRYPTED
  // AI settings (flattened)
  aiProvider: text('ai_provider'),
  aiApiKey: text('ai_api_key'), // ENCRYPTED
  aiModel: text('ai_model'),
  // S3 settings (flattened)
  s3Bucket: text('s3_bucket'),
  s3Region: text('s3_region'),
  s3AccessKeyId: text('s3_access_key_id'), // ENCRYPTED (recommended)
  s3SecretAccessKey: text('s3_secret_access_key'), // ENCRYPTED
  s3Endpoint: text('s3_endpoint'),
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
