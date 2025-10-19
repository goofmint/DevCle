/**
 * Campaign Service - List Operation
 *
 * Handles listing campaigns with pagination, filtering, and sorting.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, ilike, asc, desc, sql, type SQL } from 'drizzle-orm';
import {
  ListCampaignsSchema,
  type ListCampaignsInput,
  type ListCampaignsParams,
} from './campaign.schemas.js';

/**
 * List campaigns with pagination, filtering, and sorting
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Raw/unvalidated pagination, filter, and sort parameters (z.input type)
 * @returns Object containing campaigns array and total count
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate params using ListCampaignsSchema.parse(params)
 *    - This converts z.input → z.infer (applies defaults for limit/offset/orderBy/orderDirection)
 * 2. Build query with filters (channel, search)
 * 3. Apply sorting (orderBy, orderDirection)
 * 4. Apply pagination (limit, offset)
 * 5. Execute query and count query in parallel
 * 6. Return { campaigns, total }
 *
 * Filters:
 * - channel: Filter by channel (exact match)
 * - search: Search in name (case-insensitive partial match)
 *
 * Pagination:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 *
 * Sorting:
 * - orderBy: Field to sort by ('name', 'startDate', 'endDate', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Example usage:
 * ```typescript
 * // Caller passes raw input (defaults will be applied)
 * const result = await listCampaigns('default', {
 *   // limit, offset, orderBy, orderDirection are optional
 *   // Defaults: limit=50, offset=0, orderBy='createdAt', orderDirection='desc'
 *   channel: 'event',
 *   search: 'Launch',
 *   orderBy: 'startDate',
 *   orderDirection: 'desc',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listCampaigns(
  tenantId: string,
  params: ListCampaignsInput
): Promise<{
  campaigns: Array<typeof schema.campaigns.$inferSelect>;
  total: number;
}> {
  // 1. Validate and apply defaults
  const validated: ListCampaignsParams = ListCampaignsSchema.parse(params);

  // 2. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 2. Build WHERE conditions
      const whereConditions: SQL[] = [
        eq(schema.campaigns.tenantId, tenantId),
      ];

      // Filter by channel if provided (exact match)
      if (validated.channel) {
        whereConditions.push(eq(schema.campaigns.channel, validated.channel));
      }

      // Search in name (case-insensitive partial match)
      if (validated.search) {
        const searchPattern = `%${validated.search}%`;
        whereConditions.push(ilike(schema.campaigns.name, searchPattern));
      }

      // Combine conditions with AND (RLS will add tenant_id filter automatically)
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // 3. Determine sort column
      const sortColumn =
        validated.orderBy === 'name'
          ? schema.campaigns.name
          : validated.orderBy === 'startDate'
          ? schema.campaigns.startDate
          : validated.orderBy === 'endDate'
          ? schema.campaigns.endDate
          : validated.orderBy === 'updatedAt'
          ? schema.campaigns.updatedAt
          : schema.campaigns.createdAt;

      // Determine sort direction
      const sortOrder = validated.orderDirection === 'asc' ? asc : desc;

      // 4. Execute data query and count query in parallel
      const [campaigns, countResult] = await Promise.all([
        // Data query with sorting and pagination
        tx
          .select()
          .from(schema.campaigns)
          .where(whereClause)
          .orderBy(sortOrder(sortColumn))
          .limit(validated.limit)
          .offset(validated.offset),

        // Count query (without limit/offset/order) - optimized with COUNT aggregate
        tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.campaigns)
          .where(whereClause),
      ]);

      // 5. Return results
      return {
        campaigns,
        total: Number(countResult[0]?.count ?? 0),
      };
    } catch (error) {
      console.error('Failed to list campaigns:', error);
      throw new Error('Failed to retrieve campaigns from database');
    }
  });
}
