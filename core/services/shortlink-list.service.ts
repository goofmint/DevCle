/**
 * Shortlink Service - List Operation
 *
 * Retrieves shortlinks with pagination, filtering, and sorting.
 * Includes click count from activities table.
 */

import { withTenantContext } from '../db/connection.js';
import type { PluginConfigValues } from '../plugin-system/types.js';
import * as schema from '../db/schema/index.js';
import { eq, and, or, ilike, sql, desc, asc } from 'drizzle-orm';
import {
  ListShortlinksSchema,
  type ListShortlinks,
  type ListShortlinksResult,
  type ShortlinkWithClickCount,
} from './shortlink.schemas.js';

/**
 * List Shortlinks
 *
 * Retrieves a list of shortlinks with pagination, filtering, and sorting.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - List parameters
 * @returns List of shortlinks with click counts and total count
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using ListShortlinksSchema
 * 2. Apply default values: limit=50, offset=0, orderBy=createdAt, orderDirection=desc
 * 3. Query shortlinks with filters
 * 4. LEFT JOIN activities to get click count for each shortlink
 *    - JOIN condition: activities.action = 'click' AND activities.source = 'shortlink'
 *    - Extract shortlink_id from metadata: metadata->>'shortlink_id' = shortlinks.shortlink_id
 * 5. Apply sorting and pagination
 * 6. Get total count with COUNT aggregate query
 * 7. Return shortlinks and total
 *
 * Filters:
 * - campaignId: Exact match
 * - resourceId: Exact match
 * - search: ILIKE search in key or targetUrl (case-insensitive)
 *
 * Sorting:
 * - clickCount: Use COUNT(activities.activity_id) for sorting
 *
 * Example:
 * ```typescript
 * const result = await listShortlinks('default', {
 *   campaignId: 'campaign-uuid',
 *   search: 'blog',
 *   limit: 20,
 *   offset: 0,
 *   orderBy: 'clickCount',
 *   orderDirection: 'desc',
 * });
 *
 * console.log(result.shortlinks); // Array of shortlinks with clickCount
 * console.log(result.total); // Total count (not affected by limit/offset)
 * ```
 */
export async function listShortlinks(
  tenantId: string,
  input: ListShortlinks
): Promise<ListShortlinksResult> {
  // 1. Validate input and apply defaults
  const validated = ListShortlinksSchema.parse(input);
  const {
    campaignId,
    resourceId,
    search,
    limit = 50,
    offset = 0,
    orderBy = 'createdAt',
    orderDirection = 'desc',
  } = validated;

  const result = await withTenantContext(tenantId, async (tx) => {
    // 2. Build WHERE conditions
    const conditions = [eq(schema.shortlinks.tenantId, tenantId)];

    if (campaignId) {
      conditions.push(eq(schema.shortlinks.campaignId, campaignId));
    }

    if (resourceId) {
      conditions.push(eq(schema.shortlinks.resourceId, resourceId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(schema.shortlinks.key, `%${search}%`),
          ilike(schema.shortlinks.targetUrl, `%${search}%`)
        )!
      );
    }

    // 3. Query shortlinks with click count
    // Use subquery to count activities for each shortlink
    // Note: postgres.camel converts SELECT results to camelCase, but JSONB data is stored with original keys
    const clickCountSubquery = tx
      .select({
        shortlinkId: sql`(${schema.activities.metadata}->>'shortlink_id')::uuid`.as('shortlink_id'),
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.tenantId, tenantId),
          eq(schema.activities.action, 'click'),
          eq(schema.activities.source, 'shortlink'),
          sql`${schema.activities.metadata}->>'shortlink_id' IS NOT NULL`
        )
      )
      .groupBy(sql`(${schema.activities.metadata}->>'shortlink_id')::uuid`)
      .as('click_counts');

    // Query shortlinks with LEFT JOIN to click counts
    const shortlinksQuery = tx
      .select({
        shortlink: schema.shortlinks,
        clickCount: sql<number>`COALESCE(click_counts.count, 0)::int`.as('click_count'),
      })
      .from(schema.shortlinks)
      .leftJoin(
        clickCountSubquery,
        sql`${schema.shortlinks.shortlinkId} = click_counts.shortlink_id`
      )
      .where(and(...conditions));

    // 4. Apply sorting
    const shortlinksWithOrder =
      orderBy === 'clickCount'
        ? orderDirection === 'asc'
          ? shortlinksQuery.orderBy(asc(sql`click_count`))
          : shortlinksQuery.orderBy(desc(sql`click_count`))
        : orderDirection === 'asc'
          ? shortlinksQuery.orderBy(asc(schema.shortlinks[orderBy]))
          : shortlinksQuery.orderBy(desc(schema.shortlinks[orderBy]));

    // 5. Apply pagination
    const rows = await shortlinksWithOrder.limit(limit).offset(offset);

    // 6. Get total count
    const totalResult = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.shortlinks)
      .where(and(...conditions));

    const total = totalResult[0]?.count ?? 0;

    return { rows, total };
  });

  // 7. Build response
  const shortlinks: ShortlinkWithClickCount[] = result.rows.map((row) => {
    const shortUrl = `https://devcle.com/c/${row.shortlink.key}`;

    return {
      shortlinkId: row.shortlink.shortlinkId,
      key: row.shortlink.key,
      targetUrl: row.shortlink.targetUrl,
      shortUrl,
      campaignId: row.shortlink.campaignId,
      resourceId: row.shortlink.resourceId,
      attributes: row.shortlink.attributes
        ? (row.shortlink.attributes as PluginConfigValues)
        : null,
      createdAt: row.shortlink.createdAt,
      updatedAt: row.shortlink.updatedAt,
      clickCount: row.clickCount,
    };
  });

  return {
    shortlinks,
    total: result.total,
  };
}
