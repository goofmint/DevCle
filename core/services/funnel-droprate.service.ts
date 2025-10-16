/**
 * Funnel Service - Drop Rate Calculation
 *
 * Provides business logic for calculating funnel drop rates.
 * Drop rate = (Previous stage count - Current stage count) / Previous stage count * 100
 *
 * Architecture:
 * - Uses getFunnelStats() to get stage developer counts
 * - Calculates drop rates for each stage (except awareness)
 * - Returns drop rate statistics with overall conversion rate
 */

import { withTenantContext } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq, asc, sql, and } from 'drizzle-orm';
import {
  type FunnelStageKey,
  type DropRateStats,
  type FunnelDropRates,
  getFunnelStats,
} from './funnel.service';

/**
 * Calculate drop rate for a specific funnel stage
 *
 * Drop rate = (Previous stage count - Current stage count) / Previous stage count * 100
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param stageKey - Funnel stage key (engagement, adoption, advocacy only)
 * @returns Drop rate statistics, or null if stage not found or previous stage has 0 developers
 * @throws {Error} If stageKey is 'awareness' (first stage has no drop rate) or database error occurs
 *
 * Example:
 * - Awareness: 100 developers
 * - Engagement: 30 developers
 * - Engagement drop rate = (100 - 30) / 100 * 100 = 70%
 *
 * Note: This function throws an Error if called with 'awareness' stage
 * Use getFunnelDropRates() to get drop rates for all stages (awareness will have null)
 *
 * Implementation:
 * 1. Throw error if stageKey is 'awareness' (invalid usage)
 * 2. Query current stage from funnel_stages table
 * 3. Query previous stage (order_no = current.order_no - 1)
 * 4. Get unique developer counts for both stages using getFunnelStats()
 * 5. Calculate drop rate: (prev - curr) / prev * 100
 * 6. Return null if previous stage has 0 developers (division by zero)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function calculateDropRate(
  tenantId: string,
  stageKey: FunnelStageKey
): Promise<DropRateStats | null> {
  try {
    // 1. Throw error if called with 'awareness' stage (invalid usage)
    if (stageKey === 'awareness') {
      throw new Error('Cannot calculate drop rate for awareness stage (first stage has no previous stage)');
    }

    // Execute within transaction with tenant context (production-safe with connection pooling)
    return await withTenantContext(tenantId, async (tx) => {
      // 2. Query current stage from funnel_stages table
      const [currentStage] = await tx
        .select({
          stageKey: schema.funnelStages.stageKey,
          title: schema.funnelStages.title,
          orderNo: schema.funnelStages.orderNo,
        })
        .from(schema.funnelStages)
        .where(eq(schema.funnelStages.stageKey, stageKey));

      // If stage not found, return null
      if (!currentStage) {
        return null;
      }

      // 3. Query previous stage (order_no = current.order_no - 1)
      const [previousStage] = await tx
        .select({
          stageKey: schema.funnelStages.stageKey,
          title: schema.funnelStages.title,
          orderNo: schema.funnelStages.orderNo,
        })
        .from(schema.funnelStages)
        .where(eq(schema.funnelStages.orderNo, currentStage.orderNo - 1));

      // If previous stage not found, return null
      // (This should never happen in valid data, but defensive programming)
      if (!previousStage) {
        return null;
      }

      // 4. Get unique developer counts for current and previous stages
      // Query directly using tx to avoid nested withTenantContext calls
      const [currentStageResult] = await tx
        .select({
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
            eq(schema.activityFunnelMap.stageKey, currentStage.stageKey),
            eq(schema.activityFunnelMap.tenantId, tenantId)
          )
        );

      const [previousStageResult] = await tx
        .select({
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
            eq(schema.activityFunnelMap.stageKey, previousStage.stageKey),
            eq(schema.activityFunnelMap.tenantId, tenantId)
          )
        );

      const currentCount = currentStageResult?.uniqueDevelopers ?? 0;
      const previousCount = previousStageResult?.uniqueDevelopers ?? 0;

      // 5. Calculate drop rate: (prev - curr) / prev * 100
      // Return null if previous stage has 0 developers (division by zero)
      const dropRate = previousCount === 0
        ? null
        : ((previousCount - currentCount) / previousCount) * 100;

      // 6. Return drop rate statistics
      return {
        stageKey: currentStage.stageKey as FunnelStageKey,
        title: currentStage.title,
        orderNo: currentStage.orderNo,
        uniqueDevelopers: currentCount,
        previousStageCount: previousCount,
        dropRate,
      };
    });
  } catch (error) {
    // Log error for debugging
    console.error('Failed to calculate drop rate:', error);

    // Re-throw with more context (preserve original error if it's already an Error)
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to calculate drop rate: ${error}`);
  }
}

/**
 * Calculate drop rates for all funnel stages
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns Drop rate statistics for all stages with overall conversion rate
 * @throws {Error} If database error occurs
 *
 * Implementation:
 * 1. Get all funnel stages with developer counts (from getFunnelStats)
 * 2. Calculate drop rate for each stage:
 *    - Awareness: dropRate = null (first stage)
 *    - Other stages: dropRate = (prev - curr) / prev * 100
 * 3. Calculate overall conversion rate (awareness → advocacy)
 * 4. Return complete drop rate statistics
 *
 * Example:
 * ```typescript
 * const dropRates = await getFunnelDropRates('default');
 * console.log(`Overall conversion rate: ${dropRates.overallConversionRate}%`);
 * for (const stage of dropRates.stages) {
 *   console.log(`${stage.title}: ${stage.dropRate}% drop rate`);
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getFunnelDropRates(
  tenantId: string
): Promise<FunnelDropRates> {
  try {
    // 1. Get all funnel stages with developer counts (call getFunnelStats outside withTenantContext)
    // This avoids nested withTenantContext calls which can cause deadlocks
    const stats = await getFunnelStats(tenantId);

    // Execute within transaction with tenant context (production-safe with connection pooling)
    return await withTenantContext(tenantId, async (tx) => {
      // Get all stages ordered by order_no
      const stages = await tx
        .select({
          stageKey: schema.funnelStages.stageKey,
          title: schema.funnelStages.title,
          orderNo: schema.funnelStages.orderNo,
        })
        .from(schema.funnelStages)
        .orderBy(asc(schema.funnelStages.orderNo));

      // 2. Calculate drop rate for each stage
      const dropRateStats: DropRateStats[] = stages.map((stage, index) => {
        // Find current stage statistics
        const currentStats = stats.stages.find(s => s.stageKey === stage.stageKey);
        const currentCount = currentStats?.uniqueDevelopers ?? 0;

        // For awareness stage (first stage), drop rate is null
        if (index === 0) {
          return {
            stageKey: stage.stageKey as FunnelStageKey,
            title: stage.title,
            orderNo: stage.orderNo,
            uniqueDevelopers: currentCount,
            previousStageCount: 0, // No previous stage
            dropRate: null, // First stage has no drop rate
          };
        }

        // For other stages, calculate drop rate from previous stage
        const previousStage = stages[index - 1];
        const previousStats = stats.stages.find(s => s.stageKey === previousStage?.stageKey);
        const previousCount = previousStats?.uniqueDevelopers ?? 0;

        // Calculate drop rate: (prev - curr) / prev * 100
        // Return null if previous stage has 0 developers (division by zero)
        const dropRate = previousCount === 0
          ? null
          : ((previousCount - currentCount) / previousCount) * 100;

        return {
          stageKey: stage.stageKey as FunnelStageKey,
          title: stage.title,
          orderNo: stage.orderNo,
          uniqueDevelopers: currentCount,
          previousStageCount: previousCount,
          dropRate,
        };
      });

      // 3. Calculate overall conversion rate (awareness → advocacy)
      // Conversion rate = final stage count / first stage count * 100
      const awarenessCount = dropRateStats[0]?.uniqueDevelopers ?? 0;
      const advocacyCount = dropRateStats[dropRateStats.length - 1]?.uniqueDevelopers ?? 0;

      const overallConversionRate = awarenessCount === 0
        ? 0 // If no one entered the funnel, conversion rate is 0
        : (advocacyCount / awarenessCount) * 100;

      // 4. Return complete drop rate statistics
      return {
        stages: dropRateStats,
        overallConversionRate,
      };
    });
  } catch (error) {
    // Log error for debugging
    console.error('Failed to get funnel drop rates:', error);

    // Re-throw with more context
    throw new Error(`Failed to get funnel drop rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
