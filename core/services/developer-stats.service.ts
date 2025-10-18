/**
 * Developer Stats Service
 *
 * Provides funnel statistics for a specific developer.
 * Categorizes activities into funnel stages: Awareness, Engagement, Adoption, Advocacy.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Funnel stage categorization
 * Maps activity actions to their corresponding funnel stage
 */
const FUNNEL_STAGES = {
  awareness: ['click', 'view', 'visit'],
  engagement: ['attend', 'post', 'comment', 'star', 'follow'],
  adoption: ['signup', 'login', 'api_call'],
  advocacy: ['share', 'speak', 'blog', 'contribute'],
} as const;

/**
 * Activity statistics by funnel stage
 */
export interface DeveloperStats {
  totalActivities: number;
  awarenessCount: number;
  engagementCount: number;
  adoptionCount: number;
  advocacyCount: number;
}

/**
 * Get activity statistics for a developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to get stats for
 * @returns Activity counts by funnel stage
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Fetch all activities for the developer
 * 2. Categorize each activity into funnel stage based on action
 * 3. Count activities per stage
 * 4. Return aggregate statistics
 *
 * RLS: Uses withTenantContext for safe tenant isolation with connection pooling
 */
export async function getDeveloperStats(
  tenantId: string,
  developerId: string
): Promise<DeveloperStats> {
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Fetch all activities for the developer with action field
      const activities = await tx
        .select({
          action: schema.activities.action,
        })
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            eq(schema.activities.developerId, developerId)
          )
        );

      // Initialize counters for each funnel stage
      let awarenessCount = 0;
      let engagementCount = 0;
      let adoptionCount = 0;
      let advocacyCount = 0;

      // Categorize activities into funnel stages
      for (const activity of activities) {
        const action = activity.action.toLowerCase();

        if (FUNNEL_STAGES.awareness.includes(action as never)) {
          awarenessCount++;
        } else if (FUNNEL_STAGES.engagement.includes(action as never)) {
          engagementCount++;
        } else if (FUNNEL_STAGES.adoption.includes(action as never)) {
          adoptionCount++;
        } else if (FUNNEL_STAGES.advocacy.includes(action as never)) {
          advocacyCount++;
        }
        // Note: Activities with unknown actions are not counted in any stage
      }

      // Return aggregated statistics
      return {
        totalActivities: activities.length,
        awarenessCount,
        engagementCount,
        adoptionCount,
        advocacyCount,
      };
    } catch (error) {
      console.error('Failed to get developer stats:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get developer stats due to database error');
    }
  });
}
