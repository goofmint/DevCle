/**
 * Get Plugin Events Statistics Service
 *
 * Retrieves aggregated statistics for plugin events.
 */

import { and, eq, count, max, min, sql } from 'drizzle-orm';
import * as schema from '../../db/schema/index.js';
import { withTenantContext } from '../../db/connection.js';
import type { EventsStats } from './plugin-events.schemas.js';

/**
 * Get plugin events statistics
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin ID (UUID)
 * @returns Statistics for plugin events
 */
export async function getPluginEventsStats(
  tenantId: string,
  pluginId: string
): Promise<EventsStats> {
  return await withTenantContext(tenantId, async (tx) => {
    const whereClause = and(
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId)
    );

    // Get status counts
    const [counts] = await tx
      .select({
        total: count(),
        processed: sql<number>`count(*) FILTER (WHERE ${schema.pluginEventsRaw.status} = 'processed')`,
        failed: sql<number>`count(*) FILTER (WHERE ${schema.pluginEventsRaw.status} = 'failed')`,
        pending: sql<number>`count(*) FILTER (WHERE ${schema.pluginEventsRaw.status} = 'pending')`,
      })
      .from(schema.pluginEventsRaw)
      .where(whereClause);

    // Get date range
    const [dates] = await tx
      .select({
        latest: max(schema.pluginEventsRaw.ingestedAt),
        oldest: min(schema.pluginEventsRaw.ingestedAt),
      })
      .from(schema.pluginEventsRaw)
      .where(whereClause);

    return {
      total: Number(counts?.total ?? 0),
      processed: Number(counts?.processed ?? 0),
      failed: Number(counts?.failed ?? 0),
      pending: Number(counts?.pending ?? 0),
      latestIngestedAt: dates?.latest ?? null,
      oldestIngestedAt: dates?.oldest ?? null,
    };
  });
}
