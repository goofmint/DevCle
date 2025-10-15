/**
 * Shortlink Service - Create Operation
 *
 * Creates a new shortlink with auto-generated or custom key.
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { generateShortlinkKey } from '../utils/nanoid.js';
import {
  CreateShortlinkSchema,
  type CreateShortlink,
  type Shortlink,
} from './shortlink.schemas.js';

/**
 * Maximum retry attempts for key generation conflicts
 *
 * When using auto-generated keys, retry up to 3 times if key already exists.
 * This should be extremely rare given the 168 billion possible combinations.
 */
const MAX_KEY_GENERATION_RETRIES = 3;

/**
 * Create Shortlink
 *
 * Creates a new shortlink and returns the shortlink details.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Shortlink creation parameters
 * @returns Shortlink containing shortlink details
 * @throws {Error} If key already exists (unique constraint violation)
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateShortlinkSchema
 * 2. Generate key using nanoid (if key not provided)
 * 3. Insert into shortlinks table with RLS context
 * 4. Return Shortlink with full short URL
 *
 * Key generation:
 * - Use nanoid with custom alphabet (URL-safe: a-zA-Z0-9_-)
 * - Default length: 8 characters
 * - Example: "abcd1234", "XyZ_9876"
 *
 * Unique constraint handling:
 * - If key already exists, retry with new key (max 3 retries for auto-generated keys)
 * - If custom key provided and exists, throw error immediately (409 Conflict)
 *
 * Example:
 * ```typescript
 * const shortlink = await createShortlink('default', {
 *   targetUrl: 'https://example.com/blog/post-123',
 *   campaignId: 'campaign-uuid',
 *   resourceId: 'resource-uuid',
 *   attributes: {
 *     utm_source: 'twitter',
 *     utm_medium: 'social',
 *     utm_campaign: 'spring-2025',
 *   },
 * });
 *
 * console.log(shortlink.shortUrl); // "https://devcle.com/c/abcd1234"
 * ```
 */
export async function createShortlink(
  tenantId: string,
  input: CreateShortlink
): Promise<Shortlink> {
  // 1. Validate input
  const validated = CreateShortlinkSchema.parse(input);

  // 2. Determine if using custom key or auto-generated key
  const isCustomKey = !!validated.key;
  let key = validated.key || generateShortlinkKey();

  // 3. Attempt to insert with retry logic for auto-generated keys
  let lastError: Error | null = null;
  const maxAttempts = isCustomKey ? 1 : MAX_KEY_GENERATION_RETRIES;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Insert into shortlinks table with RLS context
      const result = await withTenantContext(tenantId, async (tx) => {
        const rows = await tx
          .insert(schema.shortlinks)
          .values({
            tenantId,
            key,
            targetUrl: validated.targetUrl,
            campaignId: validated.campaignId ?? null,
            resourceId: validated.resourceId ?? null,
            attributes: validated.attributes ?? null,
          })
          .returning();

        return rows[0];
      });

      if (!result) {
        throw new Error('Failed to create shortlink: no row returned');
      }

      // 4. Build full short URL
      // TODO: Get shortlink domain from system_settings table
      // For now, hardcode to https://devcle.com/c/{key}
      const shortUrl = `https://devcle.com/c/${result.key}`;

      // 5. Return Shortlink
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
      // postgres.js wraps PostgreSQL errors in error.cause
      const cause = typeof error === 'object' && error !== null && 'cause' in error ? error.cause : null;
      const causeMessage = cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : '';
      const causeCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : '';

      const isUniqueConstraintError =
        causeCode === '23505' ||
        causeMessage.includes('duplicate key') ||
        causeMessage.includes('unique constraint');

      if (isUniqueConstraintError) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If custom key, throw error immediately (no retry)
        if (isCustomKey) {
          throw new Error(
            `Shortlink with key "${key}" already exists`
          );
        }

        // If auto-generated key and not last attempt, generate new key and retry
        if (attempt < maxAttempts - 1) {
          key = generateShortlinkKey();
          continue; // Retry with new key
        }

        // If last attempt, throw error
        throw new Error(
          `Failed to generate unique shortlink key after ${maxAttempts} attempts`
        );
      }

      // Re-throw non-unique-constraint errors
      throw error;
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Failed to create shortlink');
}
