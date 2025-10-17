/**
 * Overview Service
 *
 * Provides dashboard overview statistics and timeline data.
 * Aggregates data from developers, activities, and campaigns tables.
 *
 * Functions:
 * - getOverviewStats(): Get dashboard statistics (counts and averages)
 * - getOverviewTimeline(): Get time-series data for charts
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { sql, and, eq, gte, count, countDistinct } from 'drizzle-orm';
import { calculateROI } from './roi-calculate.service.js';

/**
 * Overview Statistics
 *
 * Dashboard-level aggregated statistics.
 */
export interface OverviewStats {
  totalDevelopers: number;
  totalActivities: number;
  totalCampaigns: number;
  averageROI: number | null;
}

/**
 * Timeline Data Point
 *
 * Daily aggregated data for time-series charts.
 */
export interface TimelineDataPoint {
  date: string; // YYYY-MM-DD format
  activities: number;
  developers: number;
}

/**
 * Get Overview Statistics
 *
 * Retrieves dashboard statistics:
 * - Total number of developers
 * - Total number of activities
 * - Total number of campaigns
 * - Average ROI across all campaigns
 *
 * @param tenantId - Tenant ID for data filtering (RLS should already be set)
 * @returns Overview statistics
 *
 * @example
 * ```typescript
 * const stats = await getOverviewStats('tenant-123');
 * console.log(`Total developers: ${stats.totalDevelopers}`);
 * ```
 */
export async function getOverviewStats(
  tenantId: string
): Promise<OverviewStats> {
  const db = getDb();

  // Query 1: Count total developers
  // Uses count() aggregate function with tenant filter
  const [developerCount] = await db
    .select({ count: count() })
    .from(schema.developers)
    .where(eq(schema.developers.tenantId, tenantId));

  // Query 2: Count total activities
  // Uses count() aggregate function with tenant filter
  const [activityCount] = await db
    .select({ count: count() })
    .from(schema.activities)
    .where(eq(schema.activities.tenantId, tenantId));

  // Query 3: Count total campaigns
  // Uses count() aggregate function with tenant filter
  const [campaignCount] = await db
    .select({ count: count() })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.tenantId, tenantId));

  // Query 4: Calculate average ROI across all campaigns
  // Fetch all campaigns, calculate ROI for each, then compute average
  let averageROI: number | null = null;

  const allCampaigns = await db
    .select({ campaignId: schema.campaigns.campaignId })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.tenantId, tenantId));

  if (allCampaigns.length > 0) {
    // Calculate ROI for each campaign
    // ROI values may be null if campaign has no cost/value data
    const roiValues: number[] = [];

    for (const campaign of allCampaigns) {
      try {
        const roi = await calculateROI(tenantId, campaign.campaignId);
        // Only include campaigns with valid ROI percentage
        // roi can be null if campaign not found
        if (roi && roi.roi !== null) {
          roiValues.push(roi.roi);
        }
      } catch (error) {
        // Skip campaigns that fail ROI calculation
        // This can happen if campaign has no associated data
        console.warn(
          `Failed to calculate ROI for campaign ${campaign.campaignId}:`,
          error
        );
      }
    }

    // Calculate average if we have valid ROI values
    if (roiValues.length > 0) {
      const sum = roiValues.reduce((acc, val) => acc + val, 0);
      averageROI = sum / roiValues.length;
    }
  }

  return {
    totalDevelopers: developerCount?.count ?? 0,
    totalActivities: activityCount?.count ?? 0,
    totalCampaigns: campaignCount?.count ?? 0,
    averageROI,
  };
}

/**
 * Get Overview Timeline
 *
 * Retrieves time-series data for dashboard charts.
 * Returns daily aggregated counts of activities and unique developers.
 *
 * @param tenantId - Tenant ID for data filtering (RLS should already be set)
 * @param days - Number of days to include (default: 30)
 * @returns Array of timeline data points
 *
 * @example
 * ```typescript
 * const timeline = await getOverviewTimeline('tenant-123', 7);
 * timeline.forEach(point => {
 *   console.log(`${point.date}: ${point.activities} activities, ${point.developers} developers`);
 * });
 * ```
 */
export async function getOverviewTimeline(
  tenantId: string,
  days = 30
): Promise<TimelineDataPoint[]> {
  const db = getDb();

  // Calculate date range: today minus N days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Query: Aggregate activities and developers per day
  // Uses DATE_TRUNC to group by day, COUNT for activities, COUNT DISTINCT for unique developers
  const timeline = await db
    .select({
      date: sql<string>`DATE(${schema.activities.occurredAt})`,
      activities: count(),
      developers: countDistinct(schema.activities.developerId),
    })
    .from(schema.activities)
    .where(
      and(
        eq(schema.activities.tenantId, tenantId),
        gte(schema.activities.occurredAt, startDate)
      )
    )
    .groupBy(sql`DATE(${schema.activities.occurredAt})`)
    .orderBy(sql`DATE(${schema.activities.occurredAt})`);

  // Fill in missing dates with zero counts
  // This ensures charts have continuous data without gaps
  const dateMap = new Map<string, TimelineDataPoint>();

  // Populate map with actual data
  for (const row of timeline) {
    dateMap.set(row.date, {
      date: row.date,
      activities: row.activities,
      developers: row.developers,
    });
  }

  // Generate all dates in range and fill gaps
  const result: TimelineDataPoint[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0] ?? '';
    const existing = dateMap.get(dateStr);

    result.push(
      existing ?? {
        date: dateStr,
        activities: 0,
        developers: 0,
      }
    );

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}
