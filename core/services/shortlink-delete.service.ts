/**
 * Shortlink Service - Delete Operation
 *
 * Deletes a shortlink. Associated activities are NOT deleted (event sourcing principle).
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Delete Shortlink
 *
 * Deletes a shortlink. Associated activities are NOT deleted (event sourcing principle).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns true if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Execute DELETE with tenant_id and shortlink_id filtering
 * 2. Use RETURNING clause to detect successful deletion
 * 3. Return true if deleted, false if not found
 * 4. Activities with action="click" are NOT deleted (event log preservation)
 *
 * Example:
 * ```typescript
 * const deleted = await deleteShortlink('default', 'shortlink-uuid');
 * if (deleted) {
 *   console.log('Shortlink deleted');
 * } else {
 *   console.log('Shortlink not found');
 * }
 * ```
 */
export async function deleteShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<boolean> {
  const result = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .delete(schema.shortlinks)
      .where(
        and(
          eq(schema.shortlinks.tenantId, tenantId),
          eq(schema.shortlinks.shortlinkId, shortlinkId)
        )
      )
      .returning();

    return rows.length > 0;
  });

  return result;
}
