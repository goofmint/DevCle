/**
 * Token Service
 *
 * Handles API token management for webhook authentication (Task 8.16-8.20).
 * Tokens use format: drowltok_<32 random characters> (41 chars total).
 * Only hashed values are stored in database, never plain text.
 */

import crypto from 'crypto';
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
 * Zod schema for creating a new API token
 *
 * Validates input for token creation endpoint.
 * - name: 1-100 characters (required)
 * - scopes: array of strings with at least one element (required)
 * - expiresAt: expiration date (optional)
 */
export const CreateTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.date().optional(),
});

/**
 * Input type for createToken (raw/unvalidated data)
 */
export type CreateTokenInput = z.input<typeof CreateTokenSchema>;

/**
 * Validated parameters after schema parsing
 */
export type CreateTokenParams = z.infer<typeof CreateTokenSchema>;

/**
 * Response type for createToken (includes plain text token)
 */
export type TokenResponse = {
  tokenId: string;
  name: string;
  token: string; // ⚠️ Plain text token - only returned on creation
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
};

/**
 * Token detail response type (without plain text token and internal fields)
 *
 * Excludes:
 * - token: Plain text token (never stored in DB)
 * - tokenHash: SHA256 hash for verification (internal use only)
 */
export type TokenDetail = Omit<
  typeof schema.apiTokens.$inferSelect,
  'tokenHash'
> & {
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

/**
 * Generate a cryptographically secure API token
 *
 * @returns Token string in format: drowltok_<32 random characters> (41 chars total)
 *
 * Implementation:
 * - Uses crypto.randomBytes() for cryptographically secure random generation
 * - Converts to base64url encoding (URL-safe characters: A-Za-z0-9_-)
 * - 24 bytes generates approximately 32 characters in base64url
 * - Prefix "drowltok_" (9 chars) + random part (32 chars) = 41 chars total
 *
 * Example output: "drowltok_AbC123XyZ456def789ghiJKL012MNo"
 */
export function generateToken(): string {
  const randomBytes = crypto.randomBytes(24);
  const randomString = randomBytes.toString('base64url');
  return `drowltok_${randomString}`;
}

/**
 * Hash a token using SHA256
 *
 * @param token - Plain text token to hash
 * @returns SHA256 hash as 64-character hexadecimal string
 *
 * Implementation:
 * - Uses SHA256 cryptographic hash algorithm
 * - Returns hexadecimal representation (64 chars)
 * - This hash is stored in database, never the plain text token
 * - Used for token verification by comparing hashes
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new API token
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param userId - User ID of the token creator
 * @param input - Raw/unvalidated token creation parameters
 * @returns Token response including plain text token (⚠️ only time it's returned)
 * @throws {Error} If validation fails, name already exists, or database error occurs
 *
 * Implementation flow:
 * 1. Validate input using CreateTokenSchema.parse()
 * 2. Generate plain text token using generateToken()
 * 3. Extract token_prefix (first 16 characters for display)
 * 4. Calculate token_hash using hashToken()
 * 5. Insert into database within withTenantContext() for RLS
 * 6. Return response with plain text token
 *
 * Security:
 * - Plain text token is NEVER stored in database (only hash)
 * - Plain text token is returned ONLY on creation (cannot be retrieved later)
 * - token_prefix (first 16 chars) stored for display purposes only
 * - RLS ensures tenant isolation via withTenantContext()
 * - Unique constraint on (tenant_id, name) prevents duplicate names
 *
 * Error handling:
 * - Validation errors: thrown by Zod (caller handles 400 response)
 * - Duplicate name: PostgreSQL error code 23505 (unique violation)
 * - Other database errors: wrapped and re-thrown
 */
export async function createToken(
  tenantId: string,
  userId: string,
  input: CreateTokenInput
): Promise<TokenResponse> {
  // 1. Validate input
  const params: CreateTokenParams = CreateTokenSchema.parse(input);

  // 2. Generate plain text token
  const token = generateToken();

  // 3. Extract token prefix (first 16 characters for display)
  const tokenPrefix = token.substring(0, 16);

  // 4. Calculate token hash for storage
  const tokenHash = hashToken(token);

  // 5. Insert into database with tenant context
  return await withTenantContext(tenantId, async (tx) => {
    try {
      const [created] = await tx
        .insert(schema.apiTokens)
        .values({
          tokenId: crypto.randomUUID(),
          tenantId,
          name: params.name,
          tokenPrefix,
          tokenHash,
          scopes: params.scopes,
          expiresAt: params.expiresAt ?? null,
          createdBy: userId,
          createdAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create API token: no row returned');
      }

      // 6. Return response with plain text token (⚠️ only time it's returned)
      return {
        tokenId: created.tokenId,
        name: created.name,
        token, // ⚠️ Plain text token - only returned on creation
        tokenPrefix: created.tokenPrefix,
        scopes: created.scopes,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
        createdBy: created.createdBy,
      };
    } catch (error) {
      // Handle unique constraint violation (duplicate name)
      // Drizzle wraps PostgreSQL errors, so check both the error and its cause
      const pgError =
        error &&
        typeof error === 'object' &&
        'cause' in error &&
        error.cause &&
        typeof error.cause === 'object'
          ? error.cause
          : error;

      if (
        pgError &&
        typeof pgError === 'object' &&
        'code' in pgError &&
        pgError.code === '23505'
      ) {
        throw new Error('Token name already exists');
      }

      console.error('Failed to create API token:', error);
      throw new Error('Failed to create API token in database');
    }
  });
}

/**
 * Get API token detail by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param tokenId - Token ID to retrieve
 * @returns Token detail with computed status (excludes tokenHash)
 * @throws {Error} If token not found or database error occurs
 *
 * Implementation:
 * 1. Execute within withTenantContext() for RLS enforcement
 * 2. Query api_tokens table by token_id and tenant_id
 * 3. If not found, throw error "Token not found"
 * 4. Compute status based on revoked_at and expires_at
 * 5. Exclude tokenHash from response (destructure and omit)
 * 6. Return token detail with status (without tokenHash)
 *
 * Security:
 * - Never returns plain text token (only token_prefix)
 * - Never returns tokenHash (internal verification secret)
 * - RLS ensures tenant isolation
 * - Status computed based on current timestamp
 */
export async function getToken(
  tenantId: string,
  tokenId: string
): Promise<TokenDetail> {
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query token by token_id and tenant_id (RLS enforced via withTenantContext)
      const [token] = await tx
        .select()
        .from(schema.apiTokens)
        .where(
          and(
            eq(schema.apiTokens.tokenId, tokenId),
            eq(schema.apiTokens.tenantId, tenantId)
          )
        );

      // If not found, throw error
      if (!token) {
        throw new Error('Token not found');
      }

      // Compute status based on revoked_at and expires_at
      let status: 'active' | 'expired' | 'revoked';

      if (token.revokedAt !== null) {
        status = 'revoked';
      } else if (token.expiresAt !== null && token.expiresAt <= new Date()) {
        status = 'expired';
      } else {
        status = 'active';
      }

      // Exclude tokenHash from response (security: internal verification secret)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tokenHash, ...tokenData } = token;

      // Return token detail with status (without tokenHash)
      return {
        ...tokenData,
        status,
      };
    } catch (error) {
      // Re-throw "Token not found" error as-is
      if (error instanceof Error && error.message === 'Token not found') {
        throw error;
      }

      console.error('Failed to get API token:', error);
      throw new Error('Failed to retrieve API token from database');
    }
  });
}
