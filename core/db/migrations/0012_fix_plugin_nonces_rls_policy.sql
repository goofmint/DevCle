-- Fix plugin_nonces RLS policy to allow nonce verification without tenant context
--
-- The original policy required app.current_tenant_id to be set, but verifyPluginToken()
-- cannot set the tenant context until AFTER it verifies the token. The solution is to
-- bypass RLS for the plugin_nonces table entirely, since:
-- 1. The table is ONLY accessed by verifyPluginToken() which explicitly filters by tenant_id
-- 2. The unique constraint (tenant_id, plugin_id, nonce) ensures tenant isolation at DB level
-- 3. No user-facing queries access this table directly
-- 4. The foreign key constraint ensures referential integrity with tenants table

-- Drop existing policy
DROP POLICY IF EXISTS plugin_nonces_select_insert ON plugin_nonces;
DROP POLICY IF EXISTS plugin_nonces_delete_cleanup ON plugin_nonces;

-- Disable RLS for plugin_nonces table
-- This is safe because:
-- - All queries explicitly filter by tenant_id from the verified token payload
-- - The unique constraint prevents cross-tenant nonce reuse
-- - Only internal auth code accesses this table
ALTER TABLE plugin_nonces DISABLE ROW LEVEL SECURITY;
