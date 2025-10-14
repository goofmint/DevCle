/**
 * Campaign Service - Delete Operation
 *
 * Handles deletion of campaigns (hard delete with CASCADE support).
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * Delete a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query campaign by campaign_id (RLS applies)
 * 2. If not found, return false
 * 3. Delete campaign record using Drizzle ORM
 * 4. Return true
 *
 * Important Notes:
 * - This is a HARD DELETE (permanent removal)
 * - CASCADE deletion: Related budgets will be automatically deleted (FK constraint)
 * - SET NULL: Resources with this campaign_id will have campaign_id set to NULL (orphaned)
 * - Activities are not affected (no campaign_id foreign key)
 *
 * Cascade Behavior:
 * - budgets table: CASCADE delete (budgets belong to campaign)
 * - resources table: SET NULL (resources can exist independently)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function deleteCampaign(
  tenantId: string,
  campaignId: string
): Promise<boolean> {
  // 1. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 2. Check if campaign exists
      const existingResult = await tx
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.campaignId, campaignId))
        .limit(1);

      if (!existingResult[0]) {
        return false; // Not found
      }

      // 3. Delete record using Drizzle ORM
      // RLS policy will automatically filter by tenant_id
      // CASCADE: Related budgets will be deleted automatically
      // SET NULL: Resources will have campaign_id set to NULL
      await tx
        .delete(schema.campaigns)
        .where(eq(schema.campaigns.campaignId, campaignId));

      // 4. Return success
      return true;
    } catch (error) {
      // Log unexpected errors
      console.error('Failed to delete campaign:', error);
      throw new Error('Failed to delete campaign from database');
    }
  });
}
