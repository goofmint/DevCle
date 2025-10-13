/**
 * Activity Service - Delete Operation
 *
 * Delete activity record with GDPR compliance support.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Delete activity
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param activityId - Activity ID to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query activity by activity_id to verify it exists
 * 2. Verify it belongs to the tenant (RLS)
 * 3. Delete activity record (hard delete)
 * 4. Return true if deleted, false if not found
 *
 * Use cases:
 * - GDPR compliance (Right to be forgotten)
 * - Remove spam or test data
 * - Delete erroneous data that cannot be corrected
 *
 * Important notes:
 * - Activities are EVENT LOG, so deletion should be EXTREMELY rare
 * - Consider soft delete (add deleted_at column) for audit trail
 * - Hard delete is PERMANENT and cannot be undone
 * - Use with caution in production
 *
 * GDPR considerations:
 * - When deleting for GDPR compliance, also anonymize related data
 * - Consider keeping anonymized aggregate statistics
 * - Document deletion reason in audit log
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function deleteActivity(
  tenantId: string,
  activityId: string
): Promise<boolean> {
  // 1. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 2. Delete activity record (atomic delete with tenant scoping)
      // Use RETURNING to check if row was actually deleted (prevents TOCTOU race)
      const deletedRows = await tx
        .delete(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            eq(schema.activities.activityId, activityId)
          )
        )
        .returning();

      // 3. Return true if deleted, false if not found
      return deletedRows.length > 0;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      if (error instanceof Error) {
        throw new Error('Failed to delete activity due to database error', { cause: error });
      }
      throw new Error('Failed to delete activity due to database error');
    }
  });
}
