/**
 * Activity Service - Create Operation
 *
 * Create new activity record with deduplication support.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { CreateActivitySchema, type CreateActivityInput } from './activity.schemas.js';

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
      // Build insert values, conditionally including optional fields
      const insertValues: typeof schema.activities.$inferInsert = {
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
      };

      // Only include value if explicitly provided
      if (validated.value !== undefined) {
        insertValues.value = validated.value !== null ? validated.value.toString() : null;
      }

      const [created] = await tx
        .insert(schema.activities)
        .values(insertValues)
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
