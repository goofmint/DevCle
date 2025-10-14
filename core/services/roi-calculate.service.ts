/**
 * ROI Service - ROI Calculation
 *
 * Calculates Return on Investment (ROI) for a campaign.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { getCampaign } from './campaign.service.js';
import { getCampaignCost } from './roi-cost.service.js';
import { getCampaignValue } from './roi-value.service.js';
import type { CampaignROI } from './roi.schemas.js';

/**
 * Calculate ROI for a campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign
 * @returns ROI calculation result, or null if campaign not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Check if campaign exists (getCampaign)
 * 2. Get total cost (budgets sum)
 * 3. Get total value (activities value sum)
 * 4. Count activities attributed to campaign
 * 5. Count unique developers involved
 * 6. Calculate ROI: (value - cost) / cost * 100 (%)
 * 7. Handle edge case: if cost is 0, roi is null (division by zero)
 *
 * ROI formula:
 * ```
 * ROI = (effectValue - investment) / investment * 100 (%)
 * ```
 *
 * ROI interpretation:
 * - roi > 0: Positive return (successful campaign)
 * - roi = 0: Break-even point
 * - roi < 0: Negative return (loss)
 * - roi = null: Cannot calculate (investment is 0)
 *
 * Example:
 * ```typescript
 * const roi = await calculateROI('default', 'campaign-uuid');
 * if (roi === null) {
 *   console.log('Campaign not found');
 * } else if (roi.roi === null) {
 *   console.log('ROI cannot be calculated (no investment)');
 * } else {
 *   console.log(`ROI: ${roi.roi}%`);
 * }
 * ```
 */
export async function calculateROI(
  tenantId: string,
  campaignId: string
): Promise<CampaignROI | null> {
  // 1. Check if campaign exists
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) {
    return null; // Campaign not found
  }

  // 2. Get total cost (sum of budgets)
  const totalCost = await getCampaignCost(tenantId, campaignId);

  // 3. Get total value (sum of activity values)
  const totalValue = await getCampaignValue(tenantId, campaignId);

  // 4. Count activities and developers
  // Execute counts within tenant context
  const counts = await withTenantContext(tenantId, async (tx) => {
    // Count activities attributed to this campaign
    const activityCountResult = await tx
      .select({
        count: sql<number>`count(*)`,
      })
      .from(schema.activityCampaigns)
      .where(eq(schema.activityCampaigns.campaignId, campaignId));

    const activityCount = Number(activityCountResult[0]?.count ?? 0);

    // Count unique developers (deduplicated)
    // Join activity_campaigns -> activities -> developers
    // Count DISTINCT developer_id (exclude NULL)
    const developerCountResult = await tx
      .select({
        count: sql<number>`count(DISTINCT ${schema.activities.developerId})`,
      })
      .from(schema.activityCampaigns)
      .innerJoin(
        schema.activities,
        eq(schema.activityCampaigns.activityId, schema.activities.activityId)
      )
      .where(eq(schema.activityCampaigns.campaignId, campaignId));

    const developerCount = Number(developerCountResult[0]?.count ?? 0);

    return { activityCount, developerCount };
  });

  // 5. Calculate ROI
  // Edge case: if totalCost is "0", ROI cannot be calculated (division by zero)
  let roi: number | null = null;

  if (totalCost !== '0') {
    // Convert decimal strings to numbers for calculation
    const costNum = parseFloat(totalCost);
    const valueNum = parseFloat(totalValue);

    // ROI formula: (value - cost) / cost * 100
    const roiPercent = ((valueNum - costNum) / costNum) * 100;

    // Round to 2 decimal places
    roi = Math.round(roiPercent * 100) / 100;
  }

  // 6. Return result
  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.name,
    totalCost,
    totalValue,
    roi,
    activityCount: counts.activityCount,
    developerCount: counts.developerCount,
    calculatedAt: new Date(),
  };
}
