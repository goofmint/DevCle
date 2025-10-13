/**
 * Activity Service - List Operation
 *
 * List activities with filtering, pagination, and sorting.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { ListActivitiesSchema, type ListActivitiesInput } from './activity.schemas.js';

/**
 * List activities with filters
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Query parameters (filters, pagination, sort)
 * @returns Array of activities matching the filters
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListActivitiesSchema
 * 2. Build WHERE clause based on filters
 *    - developerId: Filter by developer_id
 *    - accountId: Filter by account_id
 *    - resourceId: Filter by resource_id
 *    - action: Filter by action
 *    - source: Filter by source
 *    - fromDate: Filter occurred_at >= fromDate
 *    - toDate: Filter occurred_at <= toDate
 * 3. Apply ORDER BY clause (occurred_at DESC by default)
 * 4. Apply LIMIT and OFFSET for pagination
 * 5. Return activities array
 *
 * Index optimization:
 * - (tenant_id, developer_id, occurred_at DESC) for per-developer queries
 * - (tenant_id, resource_id, occurred_at DESC) for per-resource queries
 * - (tenant_id, action, occurred_at DESC) for per-action queries
 * - (tenant_id, occurred_at DESC) for time-series queries
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listActivities(
  tenantId: string,
  params: ListActivitiesInput = {}
): Promise<Array<typeof schema.activities.$inferSelect>> {
  // 1. Validate input using ListActivitiesSchema
  const validated = ListActivitiesSchema.parse(params);

  // 2. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 3. Build WHERE clause based on filters
      const conditions = [eq(schema.activities.tenantId, tenantId)];

      // Add optional filters
      if (validated.developerId) {
        conditions.push(eq(schema.activities.developerId, validated.developerId));
      }
      if (validated.accountId) {
        conditions.push(eq(schema.activities.accountId, validated.accountId));
      }
      if (validated.resourceId) {
        conditions.push(eq(schema.activities.resourceId, validated.resourceId));
      }
      if (validated.action) {
        conditions.push(eq(schema.activities.action, validated.action));
      }
      if (validated.source) {
        conditions.push(eq(schema.activities.source, validated.source));
      }
      if (validated.fromDate) {
        conditions.push(gte(schema.activities.occurredAt, validated.fromDate));
      }
      if (validated.toDate) {
        conditions.push(lte(schema.activities.occurredAt, validated.toDate));
      }

      // 4. Determine order column and direction with defaults
      const orderByField = validated.orderBy ?? 'occurred_at';
      const orderDirection = validated.orderDirection ?? 'desc';
      const limit = validated.limit ?? 100;
      const offset = validated.offset ?? 0;

      const orderColumn = orderByField === 'recorded_at'
        ? schema.activities.recordedAt
        : orderByField === 'ingested_at'
        ? schema.activities.ingestedAt
        : schema.activities.occurredAt;

      // 5. Build and execute query with filters, order, limit, and offset (chain form for type safety)
      const activities = await tx
        .select()
        .from(schema.activities)
        .where(and(...conditions))
        .orderBy(orderDirection === 'asc' ? asc(orderColumn) : desc(orderColumn))
        .limit(limit)
        .offset(offset);

      return activities;
    } catch (error) {
      console.error('Failed to list activities:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to list activities due to database error');
    }
  });
}
