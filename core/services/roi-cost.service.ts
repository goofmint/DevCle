/**
 * ROI Service - Cost Calculation
 *
 * Calculates total cost (budget sum) for a campaign.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Get total cost (budget sum) for a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign
 * @returns Total cost as decimal string (e.g., "1000000")
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query budgets table filtered by campaign_id
 * 2. Use SQL SUM aggregate to calculate total
 * 3. Use COALESCE to return "0" if no budgets exist
 * 4. Return result as decimal string for precision
 *
 * SQL equivalent:
 * ```sql
 * SELECT COALESCE(SUM(amount), 0) AS total_cost
 * FROM budgets
 * WHERE campaign_id = $1 AND tenant_id = $2;
 * ```
 *
 * Notes:
 * - All budgets are assumed to be in JPY (currency field not checked)
 * - RLS (Row Level Security) is enforced via withTenantContext()
 * - Returns "0" if no budget records exist for the campaign
 */
export async function getCampaignCost(
  tenantId: string,
  campaignId: string
): Promise<string> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query: SUM(amount) from budgets where campaign_id matches
      const result = await tx
        .select({
          totalCost: sql<string>`COALESCE(SUM(${schema.budgets.amount}), 0)`,
        })
        .from(schema.budgets)
        .where(eq(schema.budgets.campaignId, campaignId));

      // Extract total cost from result (first row, first column)
      // Use COALESCE so result is never null, always returns "0" or positive value
      const totalCost = result[0]?.totalCost ?? '0';

      return totalCost;
    } catch (error) {
      console.error('Failed to calculate campaign cost:', error);
      throw new Error('Failed to calculate campaign cost due to database error');
    }
  });
}
