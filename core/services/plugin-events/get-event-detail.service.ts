/**
 * Get Plugin Event Detail Service
 *
 * Retrieves complete event information including raw data.
 */

import { and, eq } from 'drizzle-orm';
import * as schema from '../../db/schema/index.js';
import { withTenantContext } from '../../db/connection.js';
import type { PluginEventDetail } from './plugin-events.schemas.js';

/**
 * Get plugin event detail including raw data
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin ID (UUID)
 * @param eventId - Event ID (UUID)
 * @returns Event detail or null if not found
 */
export async function getPluginEventDetail(
  tenantId: string,
  pluginId: string,
  eventId: string
): Promise<PluginEventDetail | null> {
  return await withTenantContext(tenantId, async (tx) => {
    // Get event with raw data
    const [event] = await tx
      .select({
        eventId: schema.pluginEventsRaw.eventId,
        eventType: schema.pluginEventsRaw.eventType,
        status: schema.pluginEventsRaw.status,
        ingestedAt: schema.pluginEventsRaw.ingestedAt,
        processedAt: schema.pluginEventsRaw.processedAt,
        errorMessage: schema.pluginEventsRaw.errorMessage,
        rawData: schema.pluginEventsRaw.rawData,
      })
      .from(schema.pluginEventsRaw)
      .where(
        and(
          eq(schema.pluginEventsRaw.tenantId, tenantId),
          eq(schema.pluginEventsRaw.pluginId, pluginId),
          eq(schema.pluginEventsRaw.eventId, eventId)
        )
      )
      .limit(1);

    if (!event) {
      return null;
    }

    // TODO: Optionally look up related activity_id if status is 'processed'
    // This would require adding a reference in the activities table or
    // storing the activity_id in plugin_events_raw metadata

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status as 'pending' | 'processed' | 'failed',
      ingestedAt: event.ingestedAt,
      processedAt: event.processedAt,
      errorMessage: event.errorMessage,
      rawData: event.rawData,
      activityId: undefined, // Will be implemented when activity linking is added
    };
  });
}
