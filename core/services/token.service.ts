/**
 * Token Service
 *
 * Handles API token management for webhook authentication (Task 8.16-8.20).
 * Tokens use format: drowltok_<32 random characters> (41 chars total).
 * Only hashed values are stored in database, never plain text.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and, isNull, sql, type SQL, lte } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Zod schema for listing API tokens with pagination and filtering
 *
 * Validates query parameters for token list endpoint.
 * Defaults: page=1, perPage=20, status='active'
 */
export const ListTokensSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  status: z.enum(['active', 'expired', 'revoked', 'all']).default('active'),
});

/**
 * Input type for listTokens (raw/unvalidated data)
 */
export type ListTokensInput = z.input<typeof ListTokensSchema>;

/**
 * Validated parameters after schema parsing
 */
export type ListTokensParams = z.infer<typeof ListTokensSchema>;

/**
 * Token item type with computed status field
 */
export type TokenItem = typeof schema.apiTokens.$inferSelect & {
  status: 'active' | 'expired' | 'revoked';
};

/**
 * List API tokens with pagination and status filtering
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Raw/unvalidated pagination and filter parameters
 * @returns Object containing tokens array, total count, and pagination info
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate params using ListTokensSchema.parse()
 * 2. Build query with status filter:
 *    - active: revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
 *    - expired: revoked_at IS NULL AND expires_at <= NOW()
 *    - revoked: revoked_at IS NOT NULL
 *    - all: no filter (returns all tokens)
 * 3. Apply pagination (calculate offset from page and perPage)
 * 4. Execute query and count query in parallel
 * 5. Compute status for each token in response
 * 6. Return { items, total, page, perPage }
 *
 * Security:
 * - Never returns plain text tokens (only token_prefix for display)
 * - RLS ensures tenant isolation (requires app.current_tenant_id in session)
 * - Status is computed based on current timestamp
 *
 * Example usage:
 * ```typescript
 * const result = await listTokens('default', {
 *   page: 1,
 *   perPage: 20,
 *   status: 'active',
 * });
 * // Returns: { items: [...], total: 5, page: 1, perPage: 20 }
 * ```
 */
export async function listTokens(
  tenantId: string,
  params: ListTokensInput
): Promise<{
  items: TokenItem[];
  total: number;
  page: number;
  perPage: number;
}> {
  // 1. Validate and apply defaults
  const validated: ListTokensParams = ListTokensSchema.parse(params);

  // 2. Calculate offset from page and perPage
  const offset = (validated.page - 1) * validated.perPage;

  // 3. Execute within transaction with tenant context
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 4. Build WHERE conditions based on status filter
      const whereConditions: SQL[] = [
        eq(schema.apiTokens.tenantId, tenantId),
      ];

      const now = sql`NOW()`;

      // Apply status filter
      if (validated.status === 'active') {
        // Active: not revoked AND (no expiration OR not yet expired)
        whereConditions.push(isNull(schema.apiTokens.revokedAt));
        whereConditions.push(
          sql`(${schema.apiTokens.expiresAt} IS NULL OR ${schema.apiTokens.expiresAt} > ${now})`
        );
      } else if (validated.status === 'expired') {
        // Expired: not revoked AND expired
        whereConditions.push(isNull(schema.apiTokens.revokedAt));
        whereConditions.push(lte(schema.apiTokens.expiresAt, now));
      } else if (validated.status === 'revoked') {
        // Revoked: revoked_at IS NOT NULL
        whereConditions.push(sql`${schema.apiTokens.revokedAt} IS NOT NULL`);
      }
      // status === 'all': no additional filter

      // Combine conditions with AND
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // 5. Execute data query and count query in parallel
      const [tokens, countResult] = await Promise.all([
        // Data query with pagination (ordered by created_at DESC)
        tx
          .select()
          .from(schema.apiTokens)
          .where(whereClause)
          .orderBy(sql`${schema.apiTokens.createdAt} DESC`)
          .limit(validated.perPage)
          .offset(offset),

        // Count query (without limit/offset/order)
        tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.apiTokens)
          .where(whereClause),
      ]);

      // 6. Compute status for each token
      const items: TokenItem[] = tokens.map((token) => {
        let status: 'active' | 'expired' | 'revoked';

        if (token.revokedAt !== null) {
          status = 'revoked';
        } else if (token.expiresAt !== null && token.expiresAt <= new Date()) {
          status = 'expired';
        } else {
          status = 'active';
        }

        return {
          ...token,
          status,
        };
      });

      // 7. Return results with pagination info
      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: validated.page,
        perPage: validated.perPage,
      };
    } catch (error) {
      console.error('Failed to list API tokens:', error);
      throw new Error('Failed to retrieve API tokens from database');
    }
  });
}
