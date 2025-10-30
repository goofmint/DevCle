/**
 * List Plugin Events Service
 *
 * Retrieves paginated list of plugin events with filtering and sorting.
 */

import { and, eq, gte, lte, count, asc, desc, SQL } from 'drizzle-orm';
import * as schema from '../../db/schema/index.js';
import { withTenantContext } from '../../db/connection.js';
import type { ListEventsInput, ListEventsResponse, PluginEventListItem } from './plugin-events.schemas.js';

/**
 * List plugin events with filtering, sorting, and pagination
 *
 * @param tenantId - Tenant ID for RLS
 * @param pluginId - Plugin ID (UUID)
 * @param input - Filter and pagination options
 * @returns Paginated list of events
 */
export async function listPluginEvents(
  tenantId: string,
  pluginId: string,
  input: ListEventsInput
): Promise<ListEventsResponse> {
  return await withTenantContext(tenantId, async (tx) => {
    // Build base WHERE conditions
    const conditions: SQL[] = [
      eq(schema.pluginEventsRaw.tenantId, tenantId),
      eq(schema.pluginEventsRaw.pluginId, pluginId),
    ];

    // Add optional filters
    if (input.status) {
      conditions.push(eq(schema.pluginEventsRaw.status, input.status));
    }

    if (input.eventType) {
      conditions.push(eq(schema.pluginEventsRaw.eventType, input.eventType));
    }

    if (input.startDate) {
      conditions.push(gte(schema.pluginEventsRaw.ingestedAt, input.startDate));
    }

    if (input.endDate) {
      conditions.push(lte(schema.pluginEventsRaw.ingestedAt, input.endDate));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await tx
      .select({ count: count() })
      .from(schema.pluginEventsRaw)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Get paginated items (without raw_data for performance)
    const offset = (input.page - 1) * input.perPage;
    const sortOrder = input.sort === 'asc'
      ? asc(schema.pluginEventsRaw.ingestedAt)
      : desc(schema.pluginEventsRaw.ingestedAt);

    const rawItems = await tx
      .select({
        eventId: schema.pluginEventsRaw.eventId,
        eventType: schema.pluginEventsRaw.eventType,
        status: schema.pluginEventsRaw.status,
        ingestedAt: schema.pluginEventsRaw.ingestedAt,
        processedAt: schema.pluginEventsRaw.processedAt,
        errorMessage: schema.pluginEventsRaw.errorMessage,
      })
      .from(schema.pluginEventsRaw)
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(input.perPage)
      .offset(offset);

    // Map to typed items
    const items: PluginEventListItem[] = rawItems.map((item) => ({
      eventId: item.eventId,
      eventType: item.eventType,
      status: item.status as 'pending' | 'processed' | 'failed',
      ingestedAt: item.ingestedAt,
      processedAt: item.processedAt,
      errorMessage: item.errorMessage,
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / input.perPage);

    return {
      items,
      total,
      page: input.page,
      perPage: input.perPage,
      totalPages,
    };
  });
}
