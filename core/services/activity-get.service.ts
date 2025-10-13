/**
 * Activity Service - Get Operation
 *
 * Get single activity record by ID.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Get activity by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param activityId - Activity ID to retrieve
 * @returns Activity record or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query activity by activity_id
 * 2. Verify it belongs to the tenant (RLS)
 * 3. Return activity record or null
 *
 * Use cases:
 * - Get activity details for display
 * - Verify activity exists before update/delete
 * - Audit trail lookup
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getActivity(
  tenantId: string,
  activityId: string
): Promise<typeof schema.activities.$inferSelect | null> {
  return await withTenantContext(tenantId, async (tx) => {
    try {
      const result = await tx
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            eq(schema.activities.activityId, activityId)
          )
        )
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      console.error('Failed to get activity:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get activity due to database error');
    }
  });
}
