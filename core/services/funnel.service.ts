/**
 * Funnel Service - Developer Journey Analysis
 *
 * Provides business logic for funnel analysis.
 * Classifies activities into funnel stages and calculates funnel statistics.
 *
 * Architecture:
 * - Remix loader/action -> Funnel Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - RLS (Row Level Security) is enforced at database level
 *
 * Funnel Stages:
 * 1. Awareness: First contact with product/community (e.g., click, view)
 * 2. Engagement: Active participation (e.g., attend, post, comment)
 * 3. Adoption: Product usage, API calls (e.g., signup, api_call)
 * 4. Advocacy: Evangelism, content creation (e.g., blog_post, talk)
 */

import { withTenantContext } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq, and, count, asc, sql } from 'drizzle-orm';

/**
 * Funnel stage keys
 *
 * These match the `stage_key` values in the `funnel_stages` table.
 */
export const FunnelStageKey = {
  AWARENESS: 'awareness',
  ENGAGEMENT: 'engagement',
  ADOPTION: 'adoption',
  ADVOCACY: 'advocacy',
} as const;

export type FunnelStageKey = typeof FunnelStageKey[keyof typeof FunnelStageKey];

/**
 * Funnel stage definition
 *
 * Represents a single stage in the developer funnel.
 */
export interface FunnelStage {
  stageKey: FunnelStageKey;
  orderNo: number;
  title: string;
}

/**
 * Activity with funnel stage classification
 *
 * Represents an activity that has been classified into a funnel stage.
 */
export interface ClassifiedActivity {
  activityId: string;
  developerId: string | null;
  action: string;
  source: string;
  ts: Date;
  stageKey: FunnelStageKey | null;
}

/**
 * Funnel statistics for a single stage
 *
 * Contains the count of unique developers and total activities for a stage.
 */
export interface FunnelStageStats {
  stageKey: FunnelStageKey;
  title: string;
  orderNo: number;
  uniqueDevelopers: number;
  totalActivities: number;
}

/**
 * Complete funnel statistics
 *
 * Contains statistics for all funnel stages, ordered by stage order.
 */
export interface FunnelStats {
  stages: FunnelStageStats[];
  totalDevelopers: number;
}

/**
 * Drop rate statistics for a single stage
 *
 * Contains drop rate calculation for a funnel stage.
 * Drop rate represents the percentage of developers who did not progress
 * from the previous stage to the current stage.
 */
export interface DropRateStats {
  stageKey: FunnelStageKey;
  title: string;
  orderNo: number;
  uniqueDevelopers: number;
  previousStageCount: number | null; // null for awareness stage (no previous stage)
  dropRate: number | null; // Percentage (0-100), null for awareness stage or when calculation is not possible
}

/**
 * Complete funnel drop rate statistics
 *
 * Contains drop rate statistics for all funnel stages plus overall conversion rate.
 */
export interface FunnelDropRates {
  stages: DropRateStats[];
  overallConversionRate: number; // Percentage from awareness to advocacy
}

/**
 * Time series funnel data point
 *
 * Represents funnel statistics for a specific time period.
 */
export interface TimeSeriesFunnelData {
  date: Date; // Start date of the period
  stages: {
    stageKey: FunnelStageKey;
    uniqueDevelopers: number;
    dropRate: number | null;
  }[];
}

/**
 * Classify an activity into a funnel stage
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @param activityId - UUID of the activity to classify
 * @returns Activity with funnel stage classification, or null if activity not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query activity by activity_id (RLS applies)
 * 2. If not found, return null
 * 3. Look up the activity's action in the `activity_funnel_map` table
 * 4. If mapping exists, return the activity with the stage_key
 * 5. If no mapping exists, return the activity with stage_key = null
 *
 * Mapping logic:
 * - The mapping is per-tenant, stored in `activity_funnel_map` table
 * - Each tenant can customize which actions map to which stages
 * - Example mappings (from seed data):
 *   - "click" -> "awareness"
 *   - "attend" -> "engagement"
 *   - "signup" -> "adoption"
 *   - "post" -> "advocacy"
 *
 * Example usage:
 * ```typescript
 * const classified = await classifyStage('default', 'activity-uuid');
 * if (classified) {
 *   console.log(`Activity classified as ${classified.stageKey}`);
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function classifyStage(
  tenantId: string,
  activityId: string
): Promise<ClassifiedActivity | null> {
  try {
    // Execute within transaction with tenant context (production-safe with connection pooling)
    return await withTenantContext(tenantId, async (tx) => {
      // 1. Query activity by activity_id
      // RLS automatically filters by tenant_id
      const [activity] = await tx
        .select({
          activityId: schema.activities.activityId,
          developerId: schema.activities.developerId,
          action: schema.activities.action,
          source: schema.activities.source,
          occurredAt: schema.activities.occurredAt,
        })
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.activityId, activityId),
            eq(schema.activities.tenantId, tenantId)
          )
        );

      // 2. If activity not found, return null (not an error)
      if (!activity) {
        return null;
      }

      // 3. Look up the activity's action in the activity_funnel_map table
      // This is a per-tenant mapping, so each tenant can customize stage classification
      const [mapping] = await tx
        .select({
          stageKey: schema.activityFunnelMap.stageKey,
        })
        .from(schema.activityFunnelMap)
        .where(
          and(
            eq(schema.activityFunnelMap.action, activity.action),
            eq(schema.activityFunnelMap.tenantId, tenantId)
          )
        );

      // 4. Return classified activity
      // If no mapping exists, stageKey will be null (unmapped action)
      return {
        activityId: activity.activityId,
        developerId: activity.developerId,
        action: activity.action,
        source: activity.source,
        ts: activity.occurredAt,
        stageKey: (mapping?.stageKey ?? null) as FunnelStageKey | null,
      };
    });
  } catch (error) {
    // Log error for debugging
    console.error('Failed to classify activity stage:', error);

    // Re-throw with more context
    throw new Error(`Failed to classify activity stage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get funnel statistics for all stages
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @returns Funnel statistics with all stages and counts
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query all funnel stages from `funnel_stages` table (4 stages)
 * 2. For each stage:
 *    a. Join activities -> activity_funnel_map -> funnel_stages
 *    b. Count unique developers (COUNT DISTINCT developer_id)
 *    c. Count total activities (COUNT *)
 * 3. Calculate total unique developers across all stages
 * 4. Return statistics ordered by stage order
 *
 * Performance considerations:
 * - This query can be expensive for large datasets
 * - Consider caching the results in Redis (5-10 minutes TTL)
 * - Consider pre-aggregating in `developer_stats` table
 *
 * Example usage:
 * ```typescript
 * const stats = await getFunnelStats('default');
 * console.log(`Total developers: ${stats.totalDevelopers}`);
 * for (const stage of stats.stages) {
 *   console.log(`${stage.title}: ${stage.uniqueDevelopers} developers, ${stage.totalActivities} activities`);
 * }
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getFunnelStats(
  tenantId: string
): Promise<FunnelStats> {
  try {
    // Execute within transaction with tenant context (production-safe with connection pooling)
    return await withTenantContext(tenantId, async (tx) => {
      // 1. Get all funnel stages (should always return 4 stages: awareness, engagement, adoption, advocacy)
      // These are global stages, not tenant-specific
      const stages = await tx
        .select({
          stageKey: schema.funnelStages.stageKey,
          orderNo: schema.funnelStages.orderNo,
          title: schema.funnelStages.title,
        })
        .from(schema.funnelStages)
        .orderBy(asc(schema.funnelStages.orderNo));

      // 2. For each stage, calculate statistics
      // We use Promise.all to execute queries in parallel for better performance
      const stageStats = await Promise.all(stages.map(async (stage) => {
        // Query activities that match this stage
        // Join: activities -> activity_funnel_map (on action) -> filter by stage_key
        // Count: unique developers (COUNT DISTINCT) and total activities (COUNT)
        const [result] = await tx
          .select({
            // COUNT DISTINCT developer_id for unique developers
            // We use sql.raw with COALESCE to handle null values correctly
            uniqueDevelopers: sql<number>`COUNT(DISTINCT ${schema.activities.developerId})::int`,
            // COUNT activity_id for total activities
            totalActivities: count(schema.activities.activityId),
          })
          .from(schema.activities)
          .innerJoin(
            schema.activityFunnelMap,
            and(
              // Join condition: activities.action = activity_funnel_map.action
              eq(schema.activities.action, schema.activityFunnelMap.action),
              // AND activities.tenant_id = activity_funnel_map.tenant_id
              eq(schema.activities.tenantId, schema.activityFunnelMap.tenantId)
            )
          )
          .where(
            and(
              // Filter: activity_funnel_map.stage_key = current stage
              eq(schema.activityFunnelMap.stageKey, stage.stageKey),
              // AND activity_funnel_map.tenant_id = current tenant
              eq(schema.activityFunnelMap.tenantId, tenantId)
            )
          );

        // Return statistics for this stage
        // If no activities found, counts will be 0
        return {
          stageKey: stage.stageKey as FunnelStageKey,
          title: stage.title,
          orderNo: stage.orderNo,
          uniqueDevelopers: result?.uniqueDevelopers ?? 0,
          totalActivities: result?.totalActivities ?? 0,
        };
      }));

      // 3. Calculate total unique developers across all stages
      // This is the total number of developers who have performed any mapped action
      const [totalResult] = await tx
        .select({
          // COUNT DISTINCT developer_id across all activities with mapped actions
          totalDevelopers: sql<number>`COUNT(DISTINCT ${schema.activities.developerId})::int`,
        })
        .from(schema.activities)
        .innerJoin(
          schema.activityFunnelMap,
          and(
            eq(schema.activities.action, schema.activityFunnelMap.action),
            eq(schema.activities.tenantId, schema.activityFunnelMap.tenantId)
          )
        )
        .where(eq(schema.activities.tenantId, tenantId));

      // 4. Return complete funnel statistics
      return {
        stages: stageStats,
        totalDevelopers: totalResult?.totalDevelopers ?? 0,
      };
    });
  } catch (error) {
    // Log error for debugging
    console.error('Failed to get funnel statistics:', error);

    // Re-throw with more context
    throw new Error(`Failed to get funnel statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export drop rate calculation functions
export { calculateDropRate, getFunnelDropRates } from './funnel-droprate.service';

// Export time series aggregation functions
export { getFunnelTimeSeries } from './funnel-timeseries.service';
