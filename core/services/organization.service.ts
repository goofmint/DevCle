/**
 * Organization Service
 *
 * Provides business logic for organization management.
 * Handles CRUD operations and queries for organizations.
 *
 * Architecture:
 * - Remix loader/action -> Organization Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - RLS (Row Level Security) is enforced at database level
 *
 * IMPORTANT: All functions use withTenantContext() for RLS isolation.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, asc } from 'drizzle-orm';

/**
 * Get all organizations for a tenant
 *
 * Returns only organizationId and name fields for dropdown/filter use cases.
 * Results are sorted by name in ascending order.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns Array of organizations with organizationId and name only
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query organizations table for the tenant
 * 2. Select only orgId and name fields
 * 3. Sort by name ascending (alphabetical order)
 * 4. Return empty array if no organizations exist
 *
 * RLS: Uses withTenantContext() for tenant isolation
 */
export async function getAllOrganizations(
  tenantId: string
): Promise<Array<{ organizationId: string; name: string }>> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query organizations table
      // RLS policy will automatically filter by tenant_id
      const organizations = await tx
        .select({
          organizationId: schema.organizations.orgId,
          name: schema.organizations.name,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.tenantId, tenantId))
        .orderBy(asc(schema.organizations.name));

      return organizations;
    } catch (error) {
      console.error('Failed to list organizations:', error);
      throw new Error('Failed to retrieve organizations from database');
    }
  });
}

/**
 * Get organization by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param organizationId - Organization ID to retrieve
 * @returns Organization record or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query organizations table by org_id
 * 2. RLS automatically filters by tenant_id
 * 3. Return null if not found
 *
 * RLS: Uses withTenantContext() for tenant isolation
 */
export async function getOrganization(
  tenantId: string,
  organizationId: string
): Promise<typeof schema.organizations.$inferSelect | null> {
  // Execute within transaction with tenant context
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query by organization ID
      // RLS policy will automatically filter by tenant_id
      const result = await tx
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.orgId, organizationId))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      console.error('Failed to get organization:', error);
      throw new Error('Failed to retrieve organization from database');
    }
  });
}
