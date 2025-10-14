/**
 * Campaign Service - Update Operation
 *
 * Handles updating existing campaigns with partial update support.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import {
  UpdateCampaignSchema,
  type UpdateCampaignInput,
} from './campaign.schemas.js';

/**
 * Update an existing campaign
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param campaignId - UUID of the campaign to update
 * @param data - Campaign data to update (partial update supported)
 * @returns Updated campaign record or null if not found
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateCampaignSchema
 * 2. Query campaign by campaign_id (RLS applies)
 * 3. If not found, return null
 * 4. Update only provided fields using Drizzle ORM
 * 5. Return updated record
 *
 * Partial Update Support:
 * - Allows updating only specific fields
 * - Null values are treated as "set to null" (not "skip")
 * - Empty object {} is allowed (no-op, returns existing record)
 *
 * Examples:
 * - Update name only: { name: 'New Campaign Name' }
 * - Update dates: { startDate: new Date('2025-11-01'), endDate: new Date('2025-12-31') }
 * - Clear channel: { channel: null }
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function updateCampaign(
  tenantId: string,
  campaignId: string,
  data: UpdateCampaignInput
): Promise<typeof schema.campaigns.$inferSelect | null> {
  // 1. Validate input
  const validated: UpdateCampaignInput = UpdateCampaignSchema.parse(data);

  // 2. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 3. Check if campaign exists
      const existingResult = await tx
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.campaignId, campaignId))
        .limit(1);

      const existing = existingResult[0];
      if (!existing) {
        return null; // Not found
      }

      // 4. If no fields to update, return existing record (no-op)
      if (Object.keys(validated).length === 0) {
        return existing;
      }

      // 5. Build update object with date conversion
      // PostgreSQL date type expects string in 'YYYY-MM-DD' format
      const updateData: Record<string, unknown> = {};

      if (validated.name !== undefined) {
        updateData['name'] = validated.name;
      }
      if (validated.channel !== undefined) {
        updateData['channel'] = validated.channel;
      }
      if (validated.startDate !== undefined) {
        updateData['startDate'] = validated.startDate
          ? validated.startDate.toISOString().split('T')[0]
          : null;
      }
      if (validated.endDate !== undefined) {
        updateData['endDate'] = validated.endDate
          ? validated.endDate.toISOString().split('T')[0]
          : null;
      }
      if (validated.budgetTotal !== undefined) {
        updateData['budgetTotal'] = validated.budgetTotal;
      }
      if (validated.attributes !== undefined) {
        updateData['attributes'] = validated.attributes;
      }

      // Explicitly set updatedAt to current timestamp
      updateData['updatedAt'] = sql`now()`;

      // 6. Update record using Drizzle ORM
      // RLS policy will automatically filter by tenant_id
      const [result] = await tx
        .update(schema.campaigns)
        .set(updateData)
        .where(eq(schema.campaigns.campaignId, campaignId))
        .returning();

      // 7. Return updated record
      if (!result) {
        throw new Error('Failed to update campaign: No record returned');
      }

      return result;
    } catch (error) {
      // Handle database-specific errors
      if (error instanceof Error) {
        // Check for unique constraint violation (duplicate name)
        // DrizzleQueryError wraps PostgresError in 'cause' property
        const errorMessage = error.message;
        const causeMessage =
          'cause' in error &&
          error.cause instanceof Error
            ? error.cause.message
            : '';

        if (
          errorMessage.includes('duplicate key') ||
          errorMessage.includes('campaigns_tenant_name_unique') ||
          errorMessage.includes('campaigns_tenant_id_name_key') ||
          causeMessage.includes('duplicate key') ||
          causeMessage.includes('campaigns_tenant_name_unique') ||
          causeMessage.includes('campaigns_tenant_id_name_key')
        ) {
          throw new Error('Campaign with this name already exists');
        }
      }

      // Log unexpected errors
      console.error('Failed to update campaign:', error);
      throw new Error('Failed to update campaign due to database error');
    }
  });
}
