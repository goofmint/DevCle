/**
 * Shortlink Service - Update Operation
 *
 * Updates a shortlink's properties.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import {
  UpdateShortlinkSchema,
  type UpdateShortlink,
  type Shortlink,
} from './shortlink.schemas.js';

/**
 * Update Shortlink
 *
 * Updates a shortlink's properties.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @param input - Fields to update
 * @returns Updated Shortlink
 * @throws {Error} If shortlink not found (404)
 * @throws {Error} If new key already exists (409 Conflict)
 * @throws {Error} If no fields provided for update (400 Bad Request)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateShortlinkSchema
 * 2. Check if shortlink exists
 * 3. Check if at least one field is provided (throw error if empty update)
 * 4. If key is being updated, check unique constraint (tenant_id, key)
 * 5. Update shortlinks table with new values and updated_at = NOW()
 * 6. Return updated Shortlink
 *
 * Edge cases:
 * - Empty update (no fields provided): Throw 400 error
 * - Key collision: Throw 409 error with clear message
 * - Shortlink not found: Throw 404 error
 *
 * Example:
 * ```typescript
 * const updated = await updateShortlink('default', 'shortlink-uuid', {
 *   targetUrl: 'https://example.com/new-blog-post',
 *   key: 'newkey123',
 * });
 *
 * console.log(updated.key); // "newkey123"
 * console.log(updated.updatedAt); // New timestamp
 * ```
 */
export async function updateShortlink(
  tenantId: string,
  shortlinkId: string,
  input: UpdateShortlink
): Promise<Shortlink> {
  // 1. Validate input
  const validated = UpdateShortlinkSchema.parse(input);

  // 2. Check if at least one field is provided
  const hasUpdates =
    validated.targetUrl !== undefined ||
    validated.key !== undefined ||
    validated.campaignId !== undefined ||
    validated.resourceId !== undefined ||
    validated.attributes !== undefined;

  if (!hasUpdates) {
    throw new Error('At least one field must be provided for update');
  }

  // 3. Update shortlink with RLS context
  try {
    const result = await withTenantContext(tenantId, async (tx) => {
      // Check if shortlink exists
      const existing = await tx
        .select()
        .from(schema.shortlinks)
        .where(
          and(
            eq(schema.shortlinks.tenantId, tenantId),
            eq(schema.shortlinks.shortlinkId, shortlinkId)
          )
        );

      if (existing.length === 0) {
        throw new Error('Shortlink not found');
      }

      // Build update object (only include defined fields)
      const updates: Record<string, unknown> = {
        updatedAt: new Date(), // Always update timestamp
      };

      if (validated.targetUrl !== undefined) {
        updates['targetUrl'] = validated.targetUrl;
      }

      if (validated.key !== undefined) {
        updates['key'] = validated.key;
      }

      if (validated.campaignId !== undefined) {
        updates['campaignId'] = validated.campaignId;
      }

      if (validated.resourceId !== undefined) {
        updates['resourceId'] = validated.resourceId;
      }

      if (validated.attributes !== undefined) {
        updates['attributes'] = validated.attributes;
      }

      // Update shortlink
      const rows = await tx
        .update(schema.shortlinks)
        .set(updates)
        .where(
          and(
            eq(schema.shortlinks.tenantId, tenantId),
            eq(schema.shortlinks.shortlinkId, shortlinkId)
          )
        )
        .returning();

      return rows[0];
    });

    if (!result) {
      throw new Error('Failed to update shortlink: no row returned');
    }

    // 4. Build full short URL
    const shortUrl = `https://devcle.com/c/${result.key}`;

    // 5. Return updated Shortlink
    return {
      shortlinkId: result.shortlinkId,
      key: result.key,
      targetUrl: result.targetUrl,
      shortUrl,
      campaignId: result.campaignId,
      resourceId: result.resourceId,
      attributes: result.attributes
        ? (result.attributes as Record<string, unknown>)
        : null,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    // Check if error is unique constraint violation
    const isUniqueConstraintError =
      error instanceof Error &&
      (error.message.includes('unique constraint') ||
        error.message.includes('shortlinks_tenant_key_unique') ||
        ('code' in error && error.code === '23505'));

    if (isUniqueConstraintError) {
      throw new Error(
        `Shortlink with key "${validated.key}" already exists for this tenant`
      );
    }

    // Re-throw other errors
    throw error;
  }
}
