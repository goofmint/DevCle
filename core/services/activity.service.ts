/**
 * Activity Service - Developer Activity Management
 *
 * Provides business logic for recording and retrieving developer activities.
 * Activities are the foundation of DevRel analytics, tracking all developer actions.
 *
 * Architecture:
 * - Remix loader/action -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - RLS (Row Level Security) enforced for tenant isolation
 * - Time-series data with optimized indexes
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';

/**
 * Zod schema for creating activity
 *
 * Validates input data for createActivity().
 */
export const CreateActivitySchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  anonId: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  occurredAt: z.date(),
  source: z.string().min(1),
  sourceRef: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  dedupKey: z.string().nullable().optional(),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

/**
 * Zod schema for listing activities
 *
 * Validates query parameters for listActivities().
 */
export const ListActivitiesSchema = z.object({
  developerId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  action: z.string().optional(),
  source: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  orderBy: z.enum(['occurred_at', 'recorded_at', 'ingested_at']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type ListActivitiesInput = z.infer<typeof ListActivitiesSchema>;

/**
 * Zod schema for updating activity
 *
 * Validates input data for updateActivity().
 * Only specified fields will be updated (partial update).
 */
export const UpdateActivitySchema = z.object({
  developerId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  anonId: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  action: z.string().min(1).optional(),
  occurredAt: z.date().optional(),
  source: z.string().min(1).optional(),
  sourceRef: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  groupKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

/**
 * Create new activity
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param data - Activity data
 * @returns Created activity record
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateActivitySchema
 * 2. Validate that at least one of (developerId, accountId, anonId) is provided
 * 3. Generate UUID for activity_id
 * 4. Insert into activities table
 * 5. Return created activity record
 *
 * Identity Resolution:
 * - If accountId is provided, try to resolve developerId using resolveDeveloperByAccount()
 * - If developerId cannot be resolved, keep it NULL (will be resolved later)
 * - anonId is used for anonymous tracking (click_id, QR code, etc.)
 *
 * Deduplication:
 * - If dedupKey is provided, use it to prevent duplicate events
 * - dedupKey should be a hash of (source, source_ref, occurred_at, action)
 * - Unique constraint on dedup_key prevents duplicates
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function createActivity(
  tenantId: string,
  data: CreateActivityInput
): Promise<typeof schema.activities.$inferSelect> {
  // 1. Validate input using CreateActivitySchema
  const validated = CreateActivitySchema.parse(data);

  // 2. Validate that at least one ID is provided
  if (!validated.developerId && !validated.accountId && !validated.anonId) {
    throw new Error('At least one ID (developerId, accountId, or anonId) is required');
  }

  // 3. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 4. Insert activity record
      const [created] = await tx
        .insert(schema.activities)
        .values({
          activityId: crypto.randomUUID(),
          tenantId,
          developerId: validated.developerId ?? null,
          accountId: validated.accountId ?? null,
          anonId: validated.anonId ?? null,
          resourceId: validated.resourceId ?? null,
          action: validated.action,
          occurredAt: validated.occurredAt,
          source: validated.source,
          sourceRef: validated.sourceRef ?? null,
          category: validated.category ?? null,
          groupKey: validated.groupKey ?? null,
          metadata: validated.metadata ?? null,
          confidence: (validated.confidence ?? 1.0).toString(),
          dedupKey: validated.dedupKey ?? null,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create activity: No record returned');
      }

      return created;
    } catch (error) {
      console.error('Failed to create activity:', error);
      // Re-throw error with more context
      if (error instanceof Error) {
        // Check for unique constraint violation (duplicate dedupKey)
        // PostgreSQL error code 23505 = unique_violation
        const errorStr = JSON.stringify(error);
        const cause = 'cause' in error ? error.cause : null;
        const causeStr = cause ? JSON.stringify(cause) : '';

        if (
          error.message.includes('unique') ||
          error.message.includes('duplicate') ||
          errorStr.includes('unique') ||
          errorStr.includes('duplicate') ||
          causeStr.includes('23505') ||
          causeStr.includes('unique') ||
          causeStr.includes('duplicate')
        ) {
          throw new Error('Duplicate activity detected (dedupKey already exists)');
        }
        throw error;
      }
      throw new Error('Failed to create activity due to database error');
    }
  });
}

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

/**
 * Update activity
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param activityId - Activity ID to update
 * @param data - Fields to update (partial update)
 * @returns Updated activity record
 * @throws {Error} If validation fails, activity not found, or database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateActivitySchema
 * 2. Query activity by activity_id to verify it exists
 * 3. Update specified fields only (partial update)
 * 4. Return updated activity record
 *
 * Use cases:
 * - Resolve developer_id from account_id after identity resolution
 * - Update metadata with additional information
 * - Correct data entry errors
 * - Update confidence score based on new information
 *
 * Important notes:
 * - Activities are EVENT LOG, so updates should be rare
 * - Prefer creating new activities over updating existing ones (event sourcing principle)
 * - Use updates only for data correction or enrichment (e.g., developer_id resolution)
 * - Cannot update dedup_key (immutable for data integrity)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function updateActivity(
  tenantId: string,
  activityId: string,
  data: UpdateActivityInput
): Promise<typeof schema.activities.$inferSelect> {
  // 1. Validate input using UpdateActivitySchema
  const validated = UpdateActivitySchema.parse(data);

  // 2. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 3. Query activity to verify it exists
      const existingResult = await tx
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            eq(schema.activities.activityId, activityId)
          )
        )
        .limit(1);

      const existing = existingResult[0];
      if (!existing) {
        throw new Error('Activity not found');
      }

      // 4. Build update object with only provided fields
      const updateData: Partial<typeof schema.activities.$inferInsert> = {};

      if (validated.developerId !== undefined) {
        updateData.developerId = validated.developerId;
      }
      if (validated.accountId !== undefined) {
        updateData.accountId = validated.accountId;
      }
      if (validated.anonId !== undefined) {
        updateData.anonId = validated.anonId;
      }
      if (validated.resourceId !== undefined) {
        updateData.resourceId = validated.resourceId;
      }
      if (validated.action !== undefined) {
        updateData.action = validated.action;
      }
      if (validated.occurredAt !== undefined) {
        updateData.occurredAt = validated.occurredAt;
      }
      if (validated.source !== undefined) {
        updateData.source = validated.source;
      }
      if (validated.sourceRef !== undefined) {
        updateData.sourceRef = validated.sourceRef;
      }
      if (validated.category !== undefined) {
        updateData.category = validated.category;
      }
      if (validated.groupKey !== undefined) {
        updateData.groupKey = validated.groupKey;
      }
      if (validated.metadata !== undefined) {
        updateData.metadata = validated.metadata;
      }
      if (validated.confidence !== undefined) {
        updateData.confidence = validated.confidence.toString();
      }

      // 5. Update activity record (partial update)
      const [updated] = await tx
        .update(schema.activities)
        .set(updateData)
        .where(eq(schema.activities.activityId, activityId))
        .returning();

      if (!updated) {
        throw new Error('Failed to update activity: No record returned');
      }

      return updated;
    } catch (error) {
      console.error('Failed to update activity:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update activity due to database error');
    }
  });
}

/**
 * Delete activity
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param activityId - Activity ID to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query activity by activity_id to verify it exists
 * 2. Verify it belongs to the tenant (RLS)
 * 3. Delete activity record (hard delete)
 * 4. Return true if deleted, false if not found
 *
 * Use cases:
 * - GDPR compliance (Right to be forgotten)
 * - Remove spam or test data
 * - Delete erroneous data that cannot be corrected
 *
 * Important notes:
 * - Activities are EVENT LOG, so deletion should be EXTREMELY rare
 * - Consider soft delete (add deleted_at column) for audit trail
 * - Hard delete is PERMANENT and cannot be undone
 * - Use with caution in production
 *
 * GDPR considerations:
 * - When deleting for GDPR compliance, also anonymize related data
 * - Consider keeping anonymized aggregate statistics
 * - Document deletion reason in audit log
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function deleteActivity(
  tenantId: string,
  activityId: string
): Promise<boolean> {
  // 1. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 2. Query activity to verify it exists
      const existingResult = await tx
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.tenantId, tenantId),
            eq(schema.activities.activityId, activityId)
          )
        )
        .limit(1);

      // 3. Return false if not found
      if (!existingResult[0]) {
        return false;
      }

      // 4. Delete activity record (hard delete)
      await tx
        .delete(schema.activities)
        .where(eq(schema.activities.activityId, activityId));

      return true;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw new Error('Failed to delete activity due to database error');
    }
  });
}
