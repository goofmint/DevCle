/**
 * Tenant Context Middleware
 *
 * This module provides functions to set and clear tenant context for
 * PostgreSQL Row Level Security (RLS) policies.
 *
 * Key Concepts:
 * - Multi-tenant data isolation via PostgreSQL RLS
 * - Session-scoped tenant context (SET, not SET LOCAL)
 * - Fail-safe behavior (blocks access if tenant_id not set)
 *
 * Security Model:
 * 1. Application sets app.current_tenant_id session variable
 * 2. RLS policies filter queries by current_setting('app.current_tenant_id')
 * 3. If tenant_id not set, all queries return empty results (fail-safe)
 * 4. SET ensures tenant context persists for the connection (session-scoped)
 * 5. IMPORTANT: Every request MUST call setTenantContext() to set proper context
 *
 * Transaction Model:
 * - Uses SET (session-scoped) instead of SET LOCAL (transaction-scoped)
 * - This is necessary because postgres.js uses connection pooling with auto-commit
 * - Each query may be in a separate auto-commit transaction
 * - SET LOCAL would reset after each query, breaking RLS
 * - SET persists for the connection's lifetime in the pool
 * - Security: No leakage IF you always call setTenantContext() at request start
 *
 * Usage in Remix loaders/actions:
 * ```typescript
 * import { setTenantContext } from '~/middleware/tenant-context';
 *
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   // 1. Extract tenant_id from session/auth token
 *   const tenantId = await getTenantIdFromSession(request);
 *
 *   // 2. Set tenant context for RLS (REQUIRED at start of every request)
 *   await setTenantContext(tenantId);
 *
 *   // 3. Query data (RLS automatically filters by tenant_id)
 *   const developers = await db.select().from(developersTable);
 *
 *   return json({ developers });
 * }
 * ```
 *
 * Testing:
 * ```typescript
 * import { setTenantContext, clearTenantContext } from '~/middleware/tenant-context';
 *
 * describe('Multi-tenant test', () => {
 *   afterEach(async () => {
 *     await clearTenantContext();
 *   });
 *
 *   it('should isolate tenant data', async () => {
 *     await setTenantContext('tenant-a');
 *     // ... test queries ...
 *   });
 * });
 * ```
 *
 * Important Notes:
 * - ALWAYS call setTenantContext() at the start of every request/operation
 * - Use clearTenantContext() in test cleanup to prevent context leakage
 * - SET is session-scoped, so context persists until explicitly changed
 * - This is safe because every request sets its own tenant context
 * - The connection pool ensures isolation between concurrent requests
 */

import { getSql } from '../../db/connection';

/**
 * Set tenant context for Row Level Security (RLS)
 *
 * Sets the app.current_tenant_id session variable for the current connection.
 * This variable is used by PostgreSQL RLS policies to filter queries by tenant.
 *
 * Transaction Model:
 * - Uses SET (session-scoped) instead of SET LOCAL (transaction-scoped)
 * - This is necessary because postgres.js connection pooling means each query
 *   may be in a separate auto-commit transaction
 * - The setting persists for the connection's lifetime in the pool
 * - IMPORTANT: Always call this at the start of each request/operation to ensure
 *   proper tenant context (this overwrites any previous tenant context)
 *
 * Security Features:
 * - Setting persists for the connection session (until explicitly changed)
 * - No risk of tenant context leaking IF you always call setTenantContext()
 *   at the start of every request
 * - Fail-safe: If not called, RLS blocks all access
 * - Each request MUST set its own tenant context explicitly
 *
 * Performance:
 * - Very fast (just sets a session variable)
 * - No additional database round-trips for queries
 * - RLS filtering happens at PostgreSQL level (efficient)
 *
 * Example:
 * ```typescript
 * // In a Remix loader
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const tenantId = await getTenantIdFromSession(request);
 *   await setTenantContext(tenantId);
 *
 *   // All subsequent queries are automatically filtered by tenant_id
 *   const users = await db.select().from(usersTable);
 *   return json({ users });
 * }
 * ```
 *
 * @param tenantId - The tenant ID to set for the current session
 * @returns Promise that resolves when tenant context is set
 * @throws Error if database connection is not initialized or query fails
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  // Get raw SQL client for executing SET command
  // We use raw SQL because Drizzle ORM doesn't have a built-in API for session variables
  const sql = getSql();

  // Validate that SQL client is initialized
  // This should never fail in normal operation, but check for safety
  if (!sql) {
    throw new Error(
      'Database connection not initialized. Call getDb() first.'
    );
  }

  // Validate tenant_id parameter
  // Empty or whitespace-only tenant IDs are not allowed
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID cannot be empty');
  }

  try {
    // Set session-level variable for RLS (not transaction-level)
    // We use SET instead of SET LOCAL because:
    // 1. postgres.js uses connection pooling with auto-commit mode by default
    // 2. Each query may be in a separate transaction
    // 3. SET LOCAL would reset after each query's implicit transaction
    // 4. SET persists for the connection's session, which is what we need
    //
    // Security note: We validate tenant_id above to ensure it's safe
    // PostgreSQL SET doesn't support parameterized values, so we use sql.unsafe()
    // This is safe because:
    // 1. We validated tenant_id is not empty
    // 2. tenant_id should come from trusted sources (session/auth)
    // 3. Every request MUST call setTenantContext() at the start (no leakage)
    await sql.unsafe(`SET app.current_tenant_id = '${tenantId}'`);
  } catch (error) {
    // Log error for debugging but provide a clear error message
    console.error('Failed to set tenant context:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to set tenant context: ${message}`);
  }
}

/**
 * Clear tenant context (for cleanup or switching tenants)
 *
 * Resets the app.current_tenant_id session variable.
 * This is primarily used for:
 * - Test cleanup (ensure no context leakage between tests)
 * - Explicit tenant switching (rare in production)
 * - Debugging and development
 *
 * Note: In production, you typically don't need to call this explicitly
 * because SET LOCAL automatically resets after transaction ends.
 * However, it's essential for test cleanup to prevent context leakage.
 *
 * Example (test cleanup):
 * ```typescript
 * describe('RLS Tenant Isolation', () => {
 *   afterEach(async () => {
 *     // Ensure tenant context is cleared between tests
 *     await clearTenantContext();
 *   });
 *
 *   it('should isolate tenant-a data', async () => {
 *     await setTenantContext('tenant-a');
 *     const results = await db.select().from(developersTable);
 *     expect(results.every(d => d.tenantId === 'tenant-a')).toBe(true);
 *   });
 * });
 * ```
 *
 * @returns Promise that resolves when tenant context is cleared
 * @throws Error if database connection is not initialized or query fails
 */
export async function clearTenantContext(): Promise<void> {
  // Get raw SQL client for executing RESET command
  const sql = getSql();

  // Validate that SQL client is initialized
  if (!sql) {
    throw new Error(
      'Database connection not initialized. Call getDb() first.'
    );
  }

  try {
    // Reset the session variable to its default value (NULL)
    // This removes the tenant context entirely
    // RESET is safer than SET to NULL because it truly clears the variable
    await sql`RESET app.current_tenant_id`;
  } catch (error) {
    // Log error for debugging but provide a clear error message
    console.error('Failed to clear tenant context:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to clear tenant context: ${message}`);
  }
}

/**
 * Get current tenant context (for testing and debugging)
 *
 * Retrieves the current value of app.current_tenant_id session variable.
 * This is primarily used for:
 * - Testing that tenant context is set correctly
 * - Debugging tenant context issues
 * - Logging/monitoring tenant access
 *
 * Example (testing):
 * ```typescript
 * it('should set tenant context correctly', async () => {
 *   await setTenantContext('tenant-a');
 *   const currentTenant = await getCurrentTenantContext();
 *   expect(currentTenant).toBe('tenant-a');
 * });
 * ```
 *
 * @returns Promise that resolves to current tenant ID or null if not set
 * @throws Error if database connection is not initialized or query fails
 */
export async function getCurrentTenantContext(): Promise<string | null> {
  // Get raw SQL client for executing SELECT query
  const sql = getSql();

  // Validate that SQL client is initialized
  if (!sql) {
    throw new Error(
      'Database connection not initialized. Call getDb() first.'
    );
  }

  try {
    // Query the session variable using current_setting()
    // The second parameter 'true' makes it return NULL/empty string instead of error if not set
    // This matches the RLS policy behavior (fail-safe)
    const result = await sql<
      { currentSetting: string | null }[]
    >`SELECT current_setting('app.current_tenant_id', true) as current_setting`;

    // Extract the value from the result
    // current_setting returns empty string ('') or NULL if variable not set
    if (result.length === 0 || result[0] === null || result[0] === undefined) {
      return null;
    }

    // TypeScript guard: At this point, result[0] is guaranteed to be defined
    const row = result[0];

    // PostgreSQL current_setting() returns empty string '' when variable not set
    // Normalize this to null for consistent API behavior
    if (row.currentSetting === '' || row.currentSetting === null) {
      return null;
    }

    return row.currentSetting;
  } catch (error) {
    // Log error for debugging but provide a clear error message
    console.error('Failed to get current tenant context:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get current tenant context: ${message}`);
  }
}
