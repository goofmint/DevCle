/**
 * ROI Service - Zod Schemas
 *
 * Type definitions and validation schemas for ROI calculations.
 */

import { z } from 'zod';

/**
 * CampaignROI Schema
 *
 * Result of calculateROI() containing all ROI metrics for a campaign.
 *
 * Fields:
 * - campaignId: UUID of the campaign
 * - campaignName: Name of the campaign
 * - totalCost: Total investment (sum of budgets.amount) as decimal string
 * - totalValue: Total value (sum of activities.value) as decimal string
 * - roi: Return on Investment as percentage (null if totalCost is 0)
 * - activityCount: Number of activities attributed to this campaign
 * - developerCount: Number of unique developers (deduplicated)
 * - calculatedAt: Timestamp when ROI was calculated
 *
 * ROI formula: (totalValue - totalCost) / totalCost * 100 (%)
 *
 * ROI interpretation:
 * - roi > 0: Positive return (successful campaign)
 * - roi = 0: Break-even point
 * - roi < 0: Negative return (loss)
 * - roi = null: Cannot calculate (totalCost is 0, division by zero)
 */
export const CampaignROISchema = z.object({
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  totalCost: z.string(), // decimal type from PostgreSQL
  totalValue: z.string(), // decimal type from PostgreSQL
  roi: z.number().nullable(), // percentage, null if totalCost is 0
  activityCount: z.number().int().min(0),
  developerCount: z.number().int().min(0),
  calculatedAt: z.date(),
});

export type CampaignROI = z.infer<typeof CampaignROISchema>;
