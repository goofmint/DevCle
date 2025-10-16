/**
 * Funnel Service - Time Series Aggregation
 *
 * Provides business logic for funnel time series analysis.
 * Aggregates funnel statistics by time periods (day/week/month).
 *
 * Architecture:
 * - Uses PostgreSQL DATE_TRUNC for time bucketing
 * - Aggregates unique developers per stage per time period
 * - Calculates drop rates for each time period
 */

import { withTenantContext } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq, and, asc, gte, lte, sql } from 'drizzle-orm';
import type { FunnelStageKey, TimeSeriesFunnelData } from './funnel.service';

/**
 * Get funnel statistics time series data
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param fromDate - Start date (inclusive)
 * @param toDate - End date (inclusive)
 * @param granularity - Time granularity (day, week, month)
 * @returns Time series data with developer counts and drop rates
 * @throws {Error} If database error occurs or invalid date range
 *
 * Implementation:
 * 1. Validate date range (fromDate <= toDate)
 * 2. Get all funnel stages
 * 3. For each time period, aggregate activities by occurred_at
 * 4. Calculate unique developers per stage per time period
 * 5. Calculate drop rates per time period
 * 6. Return time series data sorted by date
 *
 * Example SQL (day granularity):
 * - Use DATE_TRUNC('day', occurred_at) for grouping
 * - Join activities with activity_funnel_map
 * - COUNT DISTINCT developer_id per stage per day
 *
 * Example:
 * ```typescript
 * const timeSeries = await getFunnelTimeSeries(
 *   'default',
 *   new Date('2025-01-01'),
 *   new Date('2025-01-31'),
 *   'day'
 * );
 * for (const point of timeSeries) {
 *   console.log(`Date: ${point.date}`);
 *   for (const stage of point.stages) {
 *     console.log(`  ${stage.stageKey}: ${stage.uniqueDevelopers} developers, ${stage.dropRate}% drop`);
 *   }
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getFunnelTimeSeries(
  tenantId: string,
  fromDate: Date,
  toDate: Date,
  granularity: 'day' | 'week' | 'month'
): Promise<TimeSeriesFunnelData[]> {
  try {
    // 1. Validate date range (fromDate <= toDate)
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error('Invalid date range: fromDate must be on or before toDate');
    }

    // Execute within transaction with tenant context (production-safe with connection pooling)
    return await withTenantContext(tenantId, async (tx) => {
      // 2. Get all funnel stages ordered by order_no
      const stages = await tx
        .select({
          stageKey: schema.funnelStages.stageKey,
          orderNo: schema.funnelStages.orderNo,
        })
        .from(schema.funnelStages)
        .orderBy(asc(schema.funnelStages.orderNo));

      // 3. Aggregate activities by time period and stage
      // Use DATE_TRUNC to bucket dates by granularity
      const truncFunction = `DATE_TRUNC('${granularity}', ${schema.activities.occurredAt.name})`;

      // Query all time periods with stage counts
      // This query groups activities by time period and stage, then counts unique developers
      const timeSeriesData = await tx
        .select({
          // Time period bucket (truncated date)
          timeBucket: sql<Date>`${sql.raw(truncFunction)}`,
          // Stage key from activity_funnel_map
          stageKey: schema.activityFunnelMap.stageKey,
          // Count unique developers in this time period and stage
          uniqueDevelopers: sql<number>`COUNT(DISTINCT ${schema.activities.developerId})::int`,
        })
        .from(schema.activities)
        .innerJoin(
          schema.activityFunnelMap,
          and(
            eq(schema.activities.action, schema.activityFunnelMap.action),
            eq(schema.activities.tenantId, schema.activityFunnelMap.tenantId)
          )
        )
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            gte(schema.activities.occurredAt, fromDate),
            lte(schema.activities.occurredAt, toDate)
          )
        )
        .groupBy(sql`${sql.raw(truncFunction)}`, schema.activityFunnelMap.stageKey)
        .orderBy(sql`${sql.raw(truncFunction)}`);

      // 4. Group data by time period and calculate drop rates
      // Map: timeBucket -> Map<stageKey, uniqueDevelopers>
      const timePeriodsMap = new Map<string, Map<string, number>>();

      for (const row of timeSeriesData) {
        // Convert timeBucket to Date if it's not already (PostgreSQL returns timestamp as string in some drivers)
        const timeBucket = row.timeBucket instanceof Date ? row.timeBucket : new Date(row.timeBucket);
        const timeKey = timeBucket.toISOString();
        if (!timePeriodsMap.has(timeKey)) {
          timePeriodsMap.set(timeKey, new Map());
        }
        const stageMap = timePeriodsMap.get(timeKey);
        if (stageMap) {
          stageMap.set(row.stageKey, row.uniqueDevelopers);
        }
      }

      // 5. Convert to TimeSeriesFunnelData format with drop rates
      const result: TimeSeriesFunnelData[] = [];

      for (const [timeKey, stageMap] of Array.from(timePeriodsMap.entries())) {
        const date = new Date(timeKey);

        // Build stages array with drop rates
        const stageStats = stages.map((stage, index) => {
          const uniqueDevelopers = stageMap.get(stage.stageKey) ?? 0;

          // For awareness stage (first stage), drop rate is null
          if (index === 0) {
            return {
              stageKey: stage.stageKey as FunnelStageKey,
              uniqueDevelopers,
              dropRate: null,
            };
          }

          // For other stages, calculate drop rate from previous stage
          const previousStage = stages[index - 1];
          const previousCount = previousStage ? (stageMap.get(previousStage.stageKey) ?? 0) : 0;

          // Calculate drop rate: (prev - curr) / prev * 100
          // Return null if previous stage has 0 developers (division by zero)
          const dropRate = previousCount === 0
            ? null
            : ((previousCount - uniqueDevelopers) / previousCount) * 100;

          return {
            stageKey: stage.stageKey as FunnelStageKey,
            uniqueDevelopers,
            dropRate,
          };
        });

        result.push({
          date,
          stages: stageStats,
        });
      }

      // 6. Return time series data sorted by date (already sorted by query ORDER BY)
      return result;
    });
  } catch (error) {
    // Log error for debugging
    console.error('Failed to get funnel time series:', error);

    // Re-throw with more context (preserve original error if it's already an Error)
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get funnel time series: ${error}`);
  }
}
