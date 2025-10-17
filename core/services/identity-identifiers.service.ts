/**
 * Identity Identifiers Service - Developer Identifier Management
 *
 * Provides business logic for adding and removing developer identifiers.
 * Handles deduplication and conflict resolution.
 *
 * Architecture:
 * - Remix loader/action -> Identity Identifiers Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Deduplication via unique constraints
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Zod schema for identifier lookup
 *
 * Validates input data for addIdentifier() and resolveDeveloperByIdentifier().
 * Used for email, phone, and other non-account identifiers.
 */
export const IdentifierLookupSchema = z.object({
  kind: z.enum(['email', 'domain', 'phone', 'mlid', 'click_id', 'key_fp']),
  value: z.string().min(1),
});

export type IdentifierLookupInput = z.infer<typeof IdentifierLookupSchema>;

/**
 * Normalize identifier value for consistent matching
 *
 * Applies normalization rules based on identifier kind:
 * - email/domain: lowercase
 * - phone: remove non-numeric characters except +
 * - others: trim whitespace
 *
 * @param kind - Identifier kind
 * @param value - Raw identifier value
 * @returns Normalized value for database storage/comparison
 */
function normalizeValue(kind: string, value: string): string {
  // 1. Trim whitespace
  let normalized = value.trim();

  // 2. Lowercase for email and domain
  if (kind === 'email' || kind === 'domain') {
    normalized = normalized.toLowerCase();
  }

  // 3. Remove special characters for phone (keep only digits and +)
  if (kind === 'phone') {
    normalized = normalized.replace(/[^0-9+]/g, '');
  }

  return normalized;
}

/**
 * Add identifier to developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to add identifier to
 * @param identifier - Identifier to add (kind + value)
 * @param confidence - Confidence score (0.0-1.0, default 1.0)
 * @returns Created identifier record
 * @throws {Error} If validation fails, duplicate identifier, or database error occurs
 *
 * Implementation details:
 * 1. Validate input
 * 2. Normalize value (lowercase, trim)
 * 3. Check for duplicate identifier (same kind + value_normalized)
 * 4. If duplicate exists and belongs to same developer, update confidence
 * 5. If duplicate exists and belongs to different developer, throw error (conflict)
 * 6. Insert into developer_identifiers table
 * 7. Set first_seen and last_seen timestamps
 * 8. Return created identifier
 *
 * Deduplication:
 * - Unique constraint on (tenant_id, kind, value_normalized)
 * - Prevents multiple developers claiming same identifier
 * - If conflict detected, suggest merge operation
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function addIdentifier(
  tenantId: string,
  developerId: string,
  identifier: IdentifierLookupInput,
  confidence: number = 1.0
): Promise<typeof schema.developerIdentifiers.$inferSelect> {
  // 1. Validate input
  const validated = IdentifierLookupSchema.parse(identifier);

  // 2. Validate confidence score
  if (confidence < 0.0 || confidence > 1.0) {
    throw new Error('Confidence must be between 0.0 and 1.0');
  }

  // 3. Normalize value
  const normalizedValue = normalizeValue(validated.kind, validated.value);

  // 4. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 5. Check for duplicate identifier
      const existingResult = await tx
        .select()
        .from(schema.developerIdentifiers)
        .where(
          and(
            eq(schema.developerIdentifiers.tenantId, tenantId),
            eq(schema.developerIdentifiers.kind, validated.kind),
            eq(schema.developerIdentifiers.valueNormalized, normalizedValue)
          )
        )
        .limit(1);

      const existing = existingResult[0];

      // 6. If duplicate exists
      if (existing) {
        // Same developer: update confidence and last_seen
        if (existing.developerId === developerId) {
          const [updated] = await tx
            .update(schema.developerIdentifiers)
            .set({
              confidence: confidence.toString(),
              lastSeen: sql`now()`,
            })
            .where(
              eq(schema.developerIdentifiers.identifierId, existing.identifierId)
            )
            .returning();

          if (!updated) {
            throw new Error('Failed to update existing identifier');
          }

          return updated;
        } else {
          // Different developer: throw conflict error
          throw new Error(
            `Identifier conflict: ${validated.kind}:${normalizedValue} already belongs to another developer (${existing.developerId}). Consider merging developers.`
          );
        }
      }

      // 7. Insert new identifier
      const now = new Date();
      const [created] = await tx
        .insert(schema.developerIdentifiers)
        .values({
          identifierId: crypto.randomUUID(),
          tenantId,
          developerId,
          kind: validated.kind,
          valueNormalized: normalizedValue,
          confidence: confidence.toString(),
          attributes: null,
          firstSeen: now,
          lastSeen: now,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create identifier');
      }

      return created;
    } catch (error) {
      console.error('Failed to add identifier:', error);
      if (error instanceof Error) {
        throw error; // Re-throw our custom errors
      }
      throw new Error('Failed to add identifier due to database error');
    }
  });
}

/**
 * List identifiers for a developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to list identifiers for
 * @returns Array of identifier records sorted by createdAt descending
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query developer_identifiers table by developer_id
 * 2. RLS automatically filters by tenant_id
 * 3. Sort by firstSeen descending (most recent first)
 * 4. Return empty array if developer not found or has no identifiers
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listIdentifiers(
  tenantId: string,
  developerId: string
): Promise<Array<typeof schema.developerIdentifiers.$inferSelect>> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // Query identifiers for the specified developer
      // RLS policy will automatically filter by tenant_id
      const identifiers = await tx
        .select()
        .from(schema.developerIdentifiers)
        .where(
          and(
            eq(schema.developerIdentifiers.tenantId, tenantId),
            eq(schema.developerIdentifiers.developerId, developerId)
          )
        )
        .orderBy(sql`${schema.developerIdentifiers.firstSeen} DESC`);

      return identifiers;
    } catch (error) {
      console.error('Failed to list identifiers:', error);
      throw new Error('Failed to retrieve identifiers from database');
    }
  });
}

/**
 * Remove identifier from developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param identifierId - Identifier ID to remove
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query identifier by identifier_id
 * 2. Verify it belongs to the tenant (RLS)
 * 3. Delete identifier record
 * 4. Return true if deleted, false if not found
 *
 * IMPORTANT: This is a hard delete (permanent removal)
 * - Consider soft delete for audit trail
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function removeIdentifier(
  tenantId: string,
  identifierId: string
): Promise<boolean> {
  // 1. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 2. Query identifier to check if it exists
      const existingResult = await tx
        .select()
        .from(schema.developerIdentifiers)
        .where(
          and(
            eq(schema.developerIdentifiers.tenantId, tenantId),
            eq(schema.developerIdentifiers.identifierId, identifierId)
          )
        )
        .limit(1);

      // 3. Return false if not found
      if (!existingResult[0]) {
        return false;
      }

      // 4. Delete identifier
      await tx
        .delete(schema.developerIdentifiers)
        .where(eq(schema.developerIdentifiers.identifierId, identifierId));

      return true;
    } catch (error) {
      console.error('Failed to remove identifier:', error);
      throw new Error('Failed to remove identifier due to database error');
    }
  });
}
