/**
 * Campaign Detail Service
 *
 * Provides read-only access to campaign-related data for detail pages:
 * - Budgets (cost entries for ROI calculation)
 * - Resources (trackable objects like events, blogs, videos)
 * - Activities (developer actions via activity_campaigns junction table)
 *
 * All functions use withTenantContext for RLS compliance and pagination support.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, sql, type SQL } from 'drizzle-orm';

// ==================== Types ====================

/**
 * Parameters for getBudgets query
 */
export interface BudgetListParams {
  limit?: number;      // Max 100, default 50
  offset?: number;     // Default 0
  category?: string | undefined; // Optional filter by category
}

/**
 * Parameters for getResources query
 */
export interface ResourceListParams {
  limit?: number;      // Max 100, default 50
  offset?: number;     // Default 0
  category?: string | undefined; // Optional filter by category
}

/**
 * Parameters for getActivities query
 */
export interface ActivityListParams {
  limit?: number;    // Max 100, default 50
  offset?: number;   // Default 0
  action?: string | undefined; // Optional filter by action type
}

// ==================== getBudgets ====================

/**
 * Get budgets for a campaign
 *
 * Queries budgets table by campaign_id, sorted by spent_at DESC.
 * Returns paginated list of budget entries.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - Campaign UUID to fetch budgets for
 * @param params - Pagination and filter parameters
 * @returns Object containing budgets array and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Apply defaults: limit=50, offset=0
 * 2. Validate limit (max 100) and offset (min 0)
 * 3. Build WHERE clause with tenant_id, campaign_id, and optional category filter
 * 4. Execute data query (with pagination) and count query in parallel
 * 5. Return { budgets, total }
 *
 * Sorting: spent_at DESC, created_at DESC (most recent first)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getBudgets(
  tenantId: string,
  campaignId: string,
  params: BudgetListParams = {}
): Promise<{
  budgets: Array<typeof schema.budgets.$inferSelect>;
  total: number;
}> {
  // Apply defaults and validate
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Build WHERE conditions
      const whereConditions: SQL[] = [
        eq(schema.budgets.tenantId, tenantId),
        eq(schema.budgets.campaignId, campaignId),
      ];

      // Filter by category if provided
      if (params.category) {
        whereConditions.push(eq(schema.budgets.category, params.category));
      }

      // Combine conditions with AND
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Execute data query and count query in parallel
      const [budgets, countResult] = await Promise.all([
        // Data query with sorting and pagination
        tx
          .select()
          .from(schema.budgets)
          .where(whereClause)
          .orderBy(desc(schema.budgets.spentAt), desc(schema.budgets.createdAt))
          .limit(limit)
          .offset(offset),

        // Count query (without limit/offset/order) - optimized with COUNT aggregate
        tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.budgets)
          .where(whereClause),
      ]);

      // Return results
      return {
        budgets,
        total: Number(countResult[0]?.count ?? 0),
      };
    } catch (error) {
      console.error('Failed to get budgets:', error);
      throw new Error('Failed to retrieve budgets from database');
    }
  });
}

// ==================== getResources ====================

/**
 * Get resources for a campaign
 *
 * Queries resources table by campaign_id, sorted by created_at DESC.
 * Returns paginated list of resource entries.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - Campaign UUID to fetch resources for
 * @param params - Pagination and filter parameters
 * @returns Object containing resources array and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Apply defaults: limit=50, offset=0
 * 2. Validate limit (max 100) and offset (min 0)
 * 3. Build WHERE clause with tenant_id, campaign_id, and optional category filter
 * 4. Execute data query (with pagination) and count query in parallel
 * 5. Return { resources, total }
 *
 * Sorting: created_at DESC (most recent first)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getResources(
  tenantId: string,
  campaignId: string,
  params: ResourceListParams = {}
): Promise<{
  resources: Array<typeof schema.resources.$inferSelect>;
  total: number;
}> {
  // Apply defaults and validate
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Build WHERE conditions
      const whereConditions: SQL[] = [
        eq(schema.resources.tenantId, tenantId),
        eq(schema.resources.campaignId, campaignId),
      ];

      // Filter by category if provided
      if (params.category) {
        whereConditions.push(eq(schema.resources.category, params.category));
      }

      // Combine conditions with AND
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Execute data query and count query in parallel
      const [resources, countResult] = await Promise.all([
        // Data query with sorting and pagination
        tx
          .select()
          .from(schema.resources)
          .where(whereClause)
          .orderBy(desc(schema.resources.createdAt))
          .limit(limit)
          .offset(offset),

        // Count query (without limit/offset/order) - optimized with COUNT aggregate
        tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.resources)
          .where(whereClause),
      ]);

      // Return results
      return {
        resources,
        total: Number(countResult[0]?.count ?? 0),
      };
    } catch (error) {
      console.error('Failed to get resources:', error);
      throw new Error('Failed to retrieve resources from database');
    }
  });
}

// ==================== getActivities ====================

/**
 * Get activities for a campaign
 *
 * Queries activities table via activity_campaigns junction table.
 * Returns paginated list of activity entries attributed to this campaign.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - Campaign UUID to fetch activities for
 * @param params - Pagination and filter parameters
 * @returns Object containing activities array and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Apply defaults: limit=50, offset=0
 * 2. Validate limit (max 100) and offset (min 0)
 * 3. JOIN activities with activity_campaigns on activity_id
 * 4. Build WHERE clause with activity_campaigns.tenant_id, campaign_id, and optional action filter
 * 5. Execute data query (with pagination) and count query in parallel
 * 6. Return { activities, total }
 *
 * Sorting: occurred_at DESC (most recent first)
 *
 * Note: Activities are linked to campaigns via activity_campaigns (N:M relationship).
 * This allows multi-touch attribution where one activity can belong to multiple campaigns.
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getActivities(
  tenantId: string,
  campaignId: string,
  params: ActivityListParams = {}
): Promise<{
  activities: Array<typeof schema.activities.$inferSelect>;
  total: number;
}> {
  // Apply defaults and validate
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Build WHERE conditions for activity_campaigns junction
      const whereConditions: SQL[] = [
        eq(schema.activityCampaigns.tenantId, tenantId),
        eq(schema.activityCampaigns.campaignId, campaignId),
      ];

      // Filter by action if provided (filter on activities table)
      if (params.action) {
        whereConditions.push(eq(schema.activities.action, params.action));
      }

      // Combine conditions with AND
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Execute data query and count query in parallel
      const [activitiesResult, countResult] = await Promise.all([
        // Data query with JOIN, sorting, and pagination
        tx
          .select({
            // Select all fields from activities table
            activityId: schema.activities.activityId,
            tenantId: schema.activities.tenantId,
            developerId: schema.activities.developerId,
            accountId: schema.activities.accountId,
            anonId: schema.activities.anonId,
            resourceId: schema.activities.resourceId,
            action: schema.activities.action,
            occurredAt: schema.activities.occurredAt,
            recordedAt: schema.activities.recordedAt,
            source: schema.activities.source,
            sourceRef: schema.activities.sourceRef,
            category: schema.activities.category,
            groupKey: schema.activities.groupKey,
            metadata: schema.activities.metadata,
            confidence: schema.activities.confidence,
            value: schema.activities.value,
            dedupKey: schema.activities.dedupKey,
            ingestedAt: schema.activities.ingestedAt,
          })
          .from(schema.activityCampaigns)
          .innerJoin(
            schema.activities,
            eq(schema.activityCampaigns.activityId, schema.activities.activityId)
          )
          .where(whereClause)
          .orderBy(desc(schema.activities.occurredAt))
          .limit(limit)
          .offset(offset),

        // Count query (without limit/offset/order) - optimized with COUNT aggregate
        tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.activityCampaigns)
          .innerJoin(
            schema.activities,
            eq(schema.activityCampaigns.activityId, schema.activities.activityId)
          )
          .where(whereClause),
      ]);

      // Return results
      return {
        activities: activitiesResult,
        total: Number(countResult[0]?.count ?? 0),
      };
    } catch (error) {
      console.error('Failed to get activities:', error);
      throw new Error('Failed to retrieve activities from database');
    }
  });
}
