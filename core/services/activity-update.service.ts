/**
 * Activity Service - Update Operation
 *
 * Update activity record with partial update support.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { UpdateActivitySchema, type UpdateActivityInput } from './activity.schemas.js';

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
