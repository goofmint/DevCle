-- ==================================================================
-- PostgreSQL Row Level Security (RLS) Policies
-- Multi-Tenant Data Isolation for DevCle
-- ==================================================================
--
-- This script applies Row Level Security policies to all 24 tenant-scoped
-- tables (out of 25 total tables - schema_migrations excluded).
--
-- RLS ensures that queries automatically filter by tenant_id, preventing
-- data leakage between tenants.
--
-- Security model:
-- - Uses session variable: app.current_tenant_id
-- - Fail-safe: Returns NULL if variable not set (blocks all access)
-- - Set via: SET app.current_tenant_id = '<tenant_id>'
-- - Session-scoped: Persists for connection until explicitly changed
--
-- ==================================================================

-- ============================================================================
-- SECTION 1: Admin Tables (5 tables)
-- ============================================================================

-- 1.1 tenants table
-- Multi-tenant root table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenants
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.2 users table
-- Console users (dashboard login)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.3 api_keys table
-- API keys for programmatic access
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.4 system_settings table
-- Per-tenant configuration (SMTP, AI, domains)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON system_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 1.5 notifications table
-- Outbound notification history (email/slack/webhook)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON notifications
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 2: Core Entity Tables (5 tables)
-- ============================================================================

-- 2.1 organizations table
-- Organizations that developers belong to
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON organizations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 2.2 developers table
-- Canonical developer entities (post-merge identity container)
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON developers
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 2.3 accounts table
-- External service accounts (GitHub, Slack, X, Discord, etc.) - MOST IMPORTANT
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON accounts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 2.4 developer_identifiers table
-- Non-account identifiers (email, domain, phone, mlid, click_id, key_fp)
ALTER TABLE developer_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON developer_identifiers
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 2.5 developer_merge_logs table
-- Audit log for developer identity merges
ALTER TABLE developer_merge_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON developer_merge_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 3: Campaign/Resource Tables (3 tables)
-- ============================================================================

-- 3.1 campaigns table
-- DevRel/marketing initiatives (unit of ROI calculation)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON campaigns
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 3.2 budgets table
-- Cost entries by campaign for ROI calculations
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON budgets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 3.3 resources table
-- Trackable objects (content, events, links)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON resources
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 4: Activity Tables (2 tables)
-- ============================================================================

-- 4.1 activities table
-- Event log (who did what to which resource and when) - MOST IMPORTANT
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON activities
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 4.2 activity_campaigns table
-- N:M mapping for multi-touch attribution
ALTER TABLE activity_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON activity_campaigns
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 5: Plugin/Import Tables (5 tables)
-- ============================================================================

-- 5.1 plugins table
-- Registered plugins with per-tenant configuration
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON plugins
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 5.2 plugin_runs table
-- Execution logs for plugin jobs (shown in admin UI)
ALTER TABLE plugin_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON plugin_runs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 5.3 plugin_events_raw table
-- Raw payload archive for traceability and replay
ALTER TABLE plugin_events_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON plugin_events_raw
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 5.4 import_jobs table
-- Batch import process control with metrics for UI
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON import_jobs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 5.5 shortlinks table
-- Short URLs / QR codes for click tracking and campaign attribution
ALTER TABLE shortlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON shortlinks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 6: Analytics/Funnel Tables (4 tables)
-- ============================================================================

-- 6.1 developer_stats table
-- Aggregated counters for developers (cache)
ALTER TABLE developer_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON developer_stats
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 6.2 campaign_stats table
-- Aggregated metrics per campaign (cache)
ALTER TABLE campaign_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON campaign_stats
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- 6.3 funnel_stages table
-- Global funnel stage dictionary (NOT tenant-scoped, but enable RLS for consistency)
-- Note: This is a global table, but we enable RLS with a permissive policy
ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;

-- Permissive policy: Allow all reads (global reference data)
CREATE POLICY funnel_stages_read_all ON funnel_stages
  FOR SELECT
  USING (true);

-- Restrictive policy: Only allow writes from application (not tenant-scoped)
CREATE POLICY funnel_stages_write_restricted ON funnel_stages
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 6.4 activity_funnel_map table
-- Per-tenant action-to-stage mapping
ALTER TABLE activity_funnel_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON activity_funnel_map
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SECTION 7: System Tables (1 table - NO RLS)
-- ============================================================================

-- 7.1 schema_migrations table
-- Schema migration history - NO RLS (system table)
-- This table should be accessible without tenant filtering for migration management

-- ==================================================================
-- RLS Policy Summary
-- ==================================================================
--
-- Total tables: 25
-- RLS enabled: 24 tables
-- RLS excluded: 1 table (schema_migrations)
--
-- Security notes:
-- 1. current_setting() with second argument 'true' for fail-safe behavior
-- 2. Returns NULL if app.current_tenant_id not set (blocks all access)
-- 3. Use SET (session-scoped) to set tenant context
-- 4. Every request MUST explicitly call SET at the start
-- 5. Superuser bypasses RLS - never grant superuser to application user
--
-- ==================================================================
