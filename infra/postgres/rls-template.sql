-- rls-template.sql
-- Template for Row Level Security (RLS) policies
-- This file demonstrates how to set up RLS for multi-tenant isolation
-- Actual RLS policies will be created during migration (Task 3.5)

-- Example: Enable RLS on a table
-- ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Example: Create RLS policy for tenant isolation
-- CREATE POLICY tenant_isolation_policy ON <table_name>
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to see only their tenant's data
-- CREATE POLICY tenant_select_policy ON <table_name>
--   FOR SELECT
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to insert only into their tenant
-- CREATE POLICY tenant_insert_policy ON <table_name>
--   FOR INSERT
--   WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to update only their tenant's data
-- CREATE POLICY tenant_update_policy ON <table_name>
--   FOR UPDATE
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Example: Allow users to delete only their tenant's data
-- CREATE POLICY tenant_delete_policy ON <table_name>
--   FOR DELETE
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: Actual RLS policies will be created per table during migration
-- This template shows the pattern to follow for tenant isolation
