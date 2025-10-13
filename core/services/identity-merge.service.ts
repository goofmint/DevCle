/**
 * Identity Merge Service - Developer Profile Merging
 *
 * Provides business logic for merging developer profiles.
 * Handles data consolidation, conflict resolution, and audit logging.
 *
 * Architecture:
 * - Remix loader/action -> Identity Merge Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Transaction-based merge operations
 * - Audit trail via developer_merge_logs table
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Zod schema for merge operation
 *
 * Validates input data for mergeDevelopers().
 */
export const MergeDevelopersSchema = z.object({
  intoDeveloperId: z.string().uuid(),
  fromDeveloperId: z.string().uuid(),
  reason: z.string().optional(),
  mergedBy: z.string().uuid().nullable().optional(),
});

export type MergeDevelopersInput = z.infer<typeof MergeDevelopersSchema>;

/**
 * Merge two developer profiles
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Merge parameters (into, from, reason, mergedBy)
 * @returns Merged developer record (into_developer_id)
 * @throws {Error} If validation fails, developers don't exist, or database error occurs
 *
 * Implementation details:
 * 1. Validate input using MergeDevelopersSchema
 * 2. Verify both developers exist and belong to the same tenant
 * 3. Start database transaction
 * 4. Move all identifiers from source to target developer
 *    - Update developer_identifiers.developer_id
 * 5. Move all accounts from source to target developer
 *    - Update accounts.developer_id
 * 6. Move all activities from source to target developer (if activities table exists)
 *    - Update activities.developer_id
 * 7. Merge metadata (tags, attributes) if needed
 * 8. Insert merge log into developer_merge_logs table
 * 9. Delete source developer record
 * 10. Commit transaction
 * 11. Return target developer
 *
 * Conflict resolution:
 * - If both developers have primary_email, prefer target's email
 * - Tags are merged (union of both sets)
 * - Display name: prefer target's name if set, otherwise use source's
 * - Organization: prefer target's org_id if set
 *
 * Audit trail:
 * - Record in developer_merge_logs table
 * - Include reason, evidence (matched identifiers), and merged_by user
 *
 * IMPORTANT: This is a destructive operation (deletes source developer)
 * - Consider soft delete alternative (add deleted_at column)
 * - Ensure proper backup before merge
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function mergeDevelopers(
  tenantId: string,
  params: MergeDevelopersInput
): Promise<typeof schema.developers.$inferSelect> {
  // 1. Validate input
  const validated = MergeDevelopersSchema.parse(params);

  // 2. Validate same developer check
  if (validated.intoDeveloperId === validated.fromDeveloperId) {
    throw new Error('Cannot merge developer with itself');
  }

  // 3. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 4. Verify both developers exist and belong to same tenant
      const [targetResult, sourceResult] = await Promise.all([
        tx
          .select()
          .from(schema.developers)
          .where(
            and(
              eq(schema.developers.tenantId, tenantId),
              eq(schema.developers.developerId, validated.intoDeveloperId)
            )
          )
          .limit(1),
        tx
          .select()
          .from(schema.developers)
          .where(
            and(
              eq(schema.developers.tenantId, tenantId),
              eq(schema.developers.developerId, validated.fromDeveloperId)
            )
          )
          .limit(1),
      ]);

      const target = targetResult[0];
      const source = sourceResult[0];

      if (!target) {
        throw new Error('Target developer not found');
      }
      if (!source) {
        throw new Error('Source developer not found');
      }

      // 5. Move all identifiers from source to target
      await tx
        .update(schema.developerIdentifiers)
        .set({ developerId: validated.intoDeveloperId })
        .where(
          eq(schema.developerIdentifiers.developerId, validated.fromDeveloperId)
        );

      // 6. Move all accounts from source to target
      await tx
        .update(schema.accounts)
        .set({ developerId: validated.intoDeveloperId })
        .where(eq(schema.accounts.developerId, validated.fromDeveloperId));

      // 7. Merge tags (union of both sets)
      const mergedTags = Array.from(
        new Set([...(target.tags || []), ...(source.tags || [])])
      );

      // 8. Update target developer with merged data
      const [updatedTarget] = await tx
        .update(schema.developers)
        .set({
          // Merge tags
          tags: mergedTags,
          // Prefer target's display name, fallback to source's
          displayName: target.displayName || source.displayName,
          // Prefer target's org, fallback to source's
          orgId: target.orgId ?? source.orgId,
          // Prefer target's email, fallback to source's
          primaryEmail: target.primaryEmail ?? source.primaryEmail,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.developers.developerId, validated.intoDeveloperId))
        .returning();

      if (!updatedTarget) {
        throw new Error('Failed to update target developer');
      }

      // 9. Create simple evidence for merge log (without calling findDuplicates to avoid performance issues)
      // Just record the merge operation with basic information
      const evidence = {
        method: validated.mergedBy ? 'manual' : 'automatic',
        merged_from: source.displayName || source.developerId,
        merged_into: target.displayName || target.developerId,
      };

      // 10. Insert merge log
      await tx.insert(schema.developerMergeLogs).values({
        mergeId: crypto.randomUUID(),
        tenantId,
        intoDeveloperId: validated.intoDeveloperId,
        fromDeveloperId: validated.fromDeveloperId,
        reason: validated.reason || 'Manual merge',
        evidence,
        mergedBy: validated.mergedBy ?? null,
      });

      // 11. Delete source developer
      await tx
        .delete(schema.developers)
        .where(eq(schema.developers.developerId, validated.fromDeveloperId));

      return updatedTarget;
    } catch (error) {
      console.error('Failed to merge developers:', error);
      if (error instanceof Error) {
        throw error; // Re-throw our custom errors
      }
      throw new Error('Failed to merge developers due to database error');
    }
  });
}
