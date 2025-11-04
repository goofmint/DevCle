/**
 * Shortlink Service - Get Operations
 *
 * Retrieves shortlinks by ID or key.
 */

import { withTenantContext } from '../db/connection.js';
import type { PluginConfigValues } from '../plugin-system/types.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import type { Shortlink } from './shortlink.schemas.js';

/**
 * Build Shortlink Result
 *
 * Helper function to convert database row to Shortlink type.
 *
 * @param row - Database row from shortlinks table
 * @returns Shortlink with shortUrl field
 */
function buildShortlinkResult(row: typeof schema.shortlinks.$inferSelect): Shortlink {
  // TODO: Get shortlink domain from system_settings table
  // For now, hardcode to https://devcle.com/c/{key}
  const shortUrl = `https://devcle.com/c/${row.key}`;

  return {
    shortlinkId: row.shortlinkId,
    key: row.key,
    targetUrl: row.targetUrl,
    shortUrl,
    campaignId: row.campaignId,
    resourceId: row.resourceId,
    attributes: row.attributes ? (row.attributes as PluginConfigValues) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get Shortlink by ID
 *
 * Retrieves a shortlink by its UUID.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param shortlinkId - Shortlink UUID
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and shortlink_id
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlink('default', 'shortlink-uuid');
 * if (!shortlink) {
 *   throw new Error('Shortlink not found');
 * }
 * ```
 */
export async function getShortlink(
  tenantId: string,
  shortlinkId: string
): Promise<Shortlink | null> {
  const result = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.shortlinks)
      .where(
        and(
          eq(schema.shortlinks.tenantId, tenantId),
          eq(schema.shortlinks.shortlinkId, shortlinkId)
        )
      );

    return rows[0] ?? null;
  });

  if (!result) {
    return null;
  }

  return buildShortlinkResult(result);
}

/**
 * Get Shortlink by Key
 *
 * Retrieves a shortlink by its key.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param key - Shortlink key (e.g., "abcd1234")
 * @returns Shortlink if found, null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query shortlinks table filtered by tenant_id and key
 * 2. Return null if not found (not an error)
 * 3. Return Shortlink if found
 *
 * Example:
 * ```typescript
 * const shortlink = await getShortlinkByKey('default', 'abcd1234');
 * if (!shortlink) {
 *   return Response.json({ error: 'Not found' }, { status: 404 });
 * }
 * ```
 */
export async function getShortlinkByKey(
  tenantId: string,
  key: string
): Promise<Shortlink | null> {
  const result = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.shortlinks)
      .where(
        and(
          eq(schema.shortlinks.tenantId, tenantId),
          eq(schema.shortlinks.key, key)
        )
      );

    return rows[0] ?? null;
  });

  if (!result) {
    return null;
  }

  return buildShortlinkResult(result);
}
