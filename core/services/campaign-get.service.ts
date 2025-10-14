/**
 * Campaign Service - Get Operation
 *
 * Handles retrieval of a single campaign by ID.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * Get a single campaign by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to retrieve
 * @returns Campaign record or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query campaigns table by campaign_id
 * 2. RLS automatically filters by tenant_id
 * 3. Return null if not found (not an error)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getCampaign(
  tenantId: string,
  campaignId: string
): Promise<typeof schema.campaigns.$inferSelect | null> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query by campaign_id
      // RLS policy will automatically filter by tenant_id
      const result = await tx
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.campaignId, campaignId))
        .limit(1);

      // Return null if not found (this is expected behavior, not an error)
      return result[0] ?? null;
    } catch (error) {
      // Log unexpected errors
      console.error('Failed to get campaign:', error);
      throw new Error('Failed to retrieve campaign from database');
    }
  });
}
