/**
 * ROI Service - Value Calculation
 *
 * Calculates total value (activity value sum) for a campaign.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Get total value (activity value sum) for a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign
 * @returns Total value as decimal string (e.g., "5000000")
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Join activities and activity_campaigns tables
 * 2. Filter by campaign_id in activity_campaigns
 * 3. Use SQL SUM aggregate to calculate total of activities.value
 * 4. Use COALESCE to return "0" if no activities exist or all values are NULL
 * 5. Return result as decimal string for precision
 *
 * SQL equivalent:
 * ```sql
 * SELECT COALESCE(SUM(a.value), 0) AS total_value
 * FROM activities a
 * INNER JOIN activity_campaigns ac ON a.activity_id = ac.activity_id
 * WHERE ac.campaign_id = $1 AND a.tenant_id = $2;
 * ```
 *
 * Notes:
 * - activities.value is nullable (some activities may not have monetary value assigned)
 * - NULL values are ignored by SUM (only non-NULL values are summed)
 * - RLS (Row Level Security) is enforced via withTenantContext()
 * - Returns "0" if no activity records exist for the campaign
 * - Multi-touch attribution weight is NOT applied here (future enhancement)
 */
export async function getCampaignValue(
  tenantId: string,
  campaignId: string
): Promise<string> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query: SUM(activities.value) from activities
      // INNER JOIN activity_campaigns where campaign_id matches
      const result = await tx
        .select({
          totalValue: sql<string>`COALESCE(SUM(${schema.activities.value}), 0)`,
        })
        .from(schema.activities)
        .innerJoin(
          schema.activityCampaigns,
          eq(schema.activities.activityId, schema.activityCampaigns.activityId)
        )
        .where(eq(schema.activityCampaigns.campaignId, campaignId));

      // Extract total value from result (first row, first column)
      // Use COALESCE so result is never null, always returns "0" or positive value
      const totalValue = result[0]?.totalValue ?? '0';

      return totalValue;
    } catch (error) {
      console.error('Failed to calculate campaign value:', error);
      throw new Error('Failed to calculate campaign value due to database error');
    }
  });
}
