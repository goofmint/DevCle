/**
 * Identity Resolver Service - Developer Identity Resolution
 *
 * Provides business logic for developer identity resolution and duplicate detection.
 * Handles identifier matching and confidence scoring.
 *
 * Architecture:
 * - Remix loader/action -> Identity Resolver Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Confidence scoring (0.0-1.0) for automatic matching
 *
 * Matching Priority:
 * 1. PRIMARY: resolveDeveloperByAccount() - accounts table (GitHub, Slack, etc.)
 * 2. SECONDARY: resolveDeveloperByIdentifier() - developer_identifiers table (email, phone, etc.)
 *
 * Key Design:
 * - Account ID matching is PRIMARY because most external services provide account IDs
 * - Email matching is SECONDARY because email is rarely available (only from business cards/forms)
 * - Both account ID and email have confidence 1.0 (provider-guaranteed or exact match)
 */

import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

/**
 * Zod schema for account lookup (primary method)
 *
 * Validates input data for resolveDeveloperByAccount().
 * This is the PRIMARY matching method for most use cases.
 */
export const AccountLookupSchema = z.object({
  provider: z.string().min(1), // 'github', 'slack', 'discord', 'x', etc.
  externalUserId: z.string().min(1), // Provider-specific user ID
});

export type AccountLookupInput = z.infer<typeof AccountLookupSchema>;

/**
 * Zod schema for identifier lookup (secondary method)
 *
 * Validates input data for resolveDeveloperByIdentifier().
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
 * Combine multiple confidence scores using product formula
 *
 * Formula: combined = 1 - (1 - conf1) * (1 - conf2) * ... * (1 - confN)
 *
 * This formula ensures:
 * - Multiple weak matches increase combined confidence
 * - One high-confidence match dominates (e.g., email 1.0 + anything = 1.0)
 * - Scores never exceed 1.0
 *
 * Examples:
 * - email (1.0) + domain (0.7) = 1 - (0.0 * 0.3) = 1.0
 * - domain (0.7) + click_id (0.6) = 1 - (0.3 * 0.4) = 0.88
 *
 * @param confidences - Array of confidence scores (0.0-1.0)
 * @returns Combined confidence score (0.0-1.0)
 */
function combineConfidences(confidences: number[]): number {
  // Handle edge cases
  if (confidences.length === 0) {
    return 0.0;
  }
  if (confidences.length === 1) {
    return confidences[0]!;
  }

  // Calculate product of (1 - conf_i)
  const product = confidences.reduce((acc, conf) => acc * (1 - conf), 1);

  // Return 1 - product
  return 1 - product;
}

/**
 * Resolve developer by external service account (PRIMARY METHOD)
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param account - Account to search (provider + externalUserId)
 * @returns Developer record if found, null otherwise
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using AccountLookupSchema
 * 2. Query accounts table by (tenant_id, provider, external_user_id)
 * 3. If found and developer_id is not null, return associated developer
 * 4. Return null if no match found
 *
 * This is the PRIMARY matching method because:
 * - Most external services provide account IDs (GitHub, Slack, Discord, X, etc.)
 * - Account IDs are stable and unique per provider
 * - Confidence is 1.0 (provider guarantees identity)
 * - Email addresses are rarely available from external services
 *
 * Example usage:
 * ```typescript
 * // Find developer by GitHub account
 * const dev = await resolveDeveloperByAccount('default', {
 *   provider: 'github',
 *   externalUserId: '12345678',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function resolveDeveloperByAccount(
  tenantId: string,
  account: AccountLookupInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // 1. Validate input
  const validated = AccountLookupSchema.parse(account);

  // 2. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 3. Query accounts table by (tenant_id, provider, external_user_id)
      const accountResult = await tx
        .select()
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.tenantId, tenantId),
            eq(schema.accounts.provider, validated.provider),
            eq(schema.accounts.externalUserId, validated.externalUserId)
          )
        )
        .limit(1);

      // 4. If account not found or not linked to developer, return null
      const account = accountResult[0];
      if (!account || !account.developerId) {
        return null;
      }

      // 5. Get associated developer
      const developerResult = await tx
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.developerId, account.developerId))
        .limit(1);

      return developerResult[0] ?? null;
    } catch (error) {
      console.error('Failed to resolve developer by account:', error);
      throw new Error('Failed to resolve developer by account');
    }
  });
}

/**
 * Resolve developer by identifier (SECONDARY METHOD)
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param identifier - Identifier to search (kind + value)
 * @returns Developer record if found, null otherwise
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using IdentifierLookupSchema
 * 2. Normalize value (lowercase, trim)
 * 3. Query developer_identifiers table by (tenant_id, kind, value_normalized)
 * 4. If found, return associated developer
 * 5. If kind is 'email', fallback to accounts.email field
 * 6. If kind is 'email', fallback to developers.primary_email field
 * 7. Return null if no match found
 *
 * Matching priority for email:
 * 1. developer_identifiers table (highest priority)
 * 2. accounts table (email field)
 * 3. developers table (primary_email field)
 *
 * Note: Email matching is less common because:
 * - Most external services don't provide email addresses
 * - Email is mainly obtained through business cards or contact forms
 * - When email DOES match, confidence is 1.0 (100% same person)
 *
 * Example usage:
 * ```typescript
 * // Find developer by email (rare case)
 * const dev = await resolveDeveloperByIdentifier('default', {
 *   kind: 'email',
 *   value: 'alice@example.com',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function resolveDeveloperByIdentifier(
  tenantId: string,
  identifier: IdentifierLookupInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // 1. Validate input
  const validated = IdentifierLookupSchema.parse(identifier);

  // 2. Normalize value
  const normalizedValue = normalizeValue(validated.kind, validated.value);

  // 3. Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 4. Query developer_identifiers table (highest priority)
      const identifierResult = await tx
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

      // If found in developer_identifiers, get associated developer
      const identifierRecord = identifierResult[0];
      if (identifierRecord) {
        const developerResult = await tx
          .select()
          .from(schema.developers)
          .where(eq(schema.developers.developerId, identifierRecord.developerId))
          .limit(1);

        const developer = developerResult[0];
        if (developer) {
          return developer;
        }
      }

      // 5. If kind is 'email', fallback to accounts.email
      if (validated.kind === 'email') {
        const accountResult = await tx
          .select()
          .from(schema.accounts)
          .where(
            and(
              eq(schema.accounts.tenantId, tenantId),
              eq(schema.accounts.email, normalizedValue)
            )
          )
          .limit(1);

        const account = accountResult[0];
        if (account && account.developerId) {
          const developerResult = await tx
            .select()
            .from(schema.developers)
            .where(eq(schema.developers.developerId, account.developerId))
            .limit(1);

          const developer = developerResult[0];
          if (developer) {
            return developer;
          }
        }

        // 6. If kind is 'email', fallback to developers.primary_email
        const developerResult = await tx
          .select()
          .from(schema.developers)
          .where(
            and(
              eq(schema.developers.tenantId, tenantId),
              eq(schema.developers.primaryEmail, normalizedValue)
            )
          )
          .limit(1);

        return developerResult[0] ?? null;
      }

      // 7. No match found
      return null;
    } catch (error) {
      console.error('Failed to resolve developer by identifier:', error);
      throw new Error('Failed to resolve developer by identifier');
    }
  });
}

/**
 * Find potential duplicate developers
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - Developer ID to find duplicates for
 * @returns Array of potential duplicates with confidence scores
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Get all accounts and identifiers for the given developer
 * 2. For each account/identifier, search for other developers with matches
 * 3. Calculate confidence score based on:
 *    - Type of match (account > email > other identifiers)
 *    - Number of matching items
 *    - Existing confidence scores in identifiers table
 * 4. Return candidates sorted by confidence (highest first)
 *
 * Confidence scoring (base confidence):
 * - Same account (provider + external_user_id): 1.0 (provider-guaranteed identity)
 * - Same email: 1.0 (exact match, 100% same person)
 * - Same mlid: 0.95 (very high confidence, ML-based ID)
 * - Same phone: 0.9 (high confidence)
 * - Same key_fp: 0.85 (GPG/SSH key fingerprint)
 * - Same domain: 0.7 (likely same organization)
 * - Same click_id: 0.6 (medium confidence, anonymous tracking)
 *
 * Multiple matches (combined confidence):
 * - Combine confidences with: combined = 1 - product(1 - conf_i)
 * - Formula: combined = 1 - (1 - conf1) * (1 - conf2) * ... * (1 - confN)
 * - Example: email (1.0) + domain (0.7) = 1 - (0.0 * 0.3) = 1.0
 * - Example: domain (0.7) + click_id (0.6) = 1 - (0.3 * 0.4) = 0.88
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function findDuplicates(
  tenantId: string,
  developerId: string
): Promise<
  Array<{
    developer: typeof schema.developers.$inferSelect;
    confidence: number;
    matchedIdentifiers: Array<{
      kind: string;
      value: string;
      confidence: number;
    }>;
  }>
> {
  // Execute within transaction with tenant context (production-safe with connection pooling)
  return await withTenantContext(tenantId, async (tx) => {
    try {
      // 1. Get all accounts for the given developer
      const accounts = await tx
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.developerId, developerId));

      // 2. Get all identifiers for the given developer
      const identifiers = await tx
        .select()
        .from(schema.developerIdentifiers)
        .where(eq(schema.developerIdentifiers.developerId, developerId));

      // 3. Find other developers with matching accounts
      // Map to store potential duplicates: developerId -> { developer, matches }
      const duplicatesMap = new Map<
        string,
        {
          developer: typeof schema.developers.$inferSelect;
          matches: Array<{ kind: string; value: string; confidence: number }>;
        }
      >();

      // Search for matching accounts (confidence 1.0 for account matches)
      for (const account of accounts) {
        const matchingAccounts = await tx
          .select()
          .from(schema.accounts)
          .where(
            and(
              eq(schema.accounts.tenantId, tenantId),
              eq(schema.accounts.provider, account.provider),
              eq(schema.accounts.externalUserId, account.externalUserId)
            )
          );

        for (const matchingAccount of matchingAccounts) {
          // Skip if it's the same developer or not linked to a developer
          if (
            !matchingAccount.developerId ||
            matchingAccount.developerId === developerId
          ) {
            continue;
          }

          // Get developer record
          const developerResult = await tx
            .select()
            .from(schema.developers)
            .where(
              eq(schema.developers.developerId, matchingAccount.developerId)
            )
            .limit(1);

          const developer = developerResult[0];
          if (!developer) {
            continue;
          }

          // Add to duplicates map
          const existing = duplicatesMap.get(developer.developerId);
          const match = {
            kind: 'account',
            value: `${account.provider}:${account.externalUserId}`,
            confidence: 1.0, // Account match = 100% confidence
          };

          if (existing) {
            existing.matches.push(match);
          } else {
            duplicatesMap.set(developer.developerId, {
              developer,
              matches: [match],
            });
          }
        }
      }

      // Search for matching identifiers
      for (const identifier of identifiers) {
        const matchingIdentifiers = await tx
          .select()
          .from(schema.developerIdentifiers)
          .where(
            and(
              eq(schema.developerIdentifiers.tenantId, tenantId),
              eq(schema.developerIdentifiers.kind, identifier.kind),
              eq(
                schema.developerIdentifiers.valueNormalized,
                identifier.valueNormalized
              )
            )
          );

        for (const matchingIdentifier of matchingIdentifiers) {
          // Skip if it's the same developer
          if (matchingIdentifier.developerId === developerId) {
            continue;
          }

          // Get developer record
          const developerResult = await tx
            .select()
            .from(schema.developers)
            .where(
              eq(schema.developers.developerId, matchingIdentifier.developerId)
            )
            .limit(1);

          const developer = developerResult[0];
          if (!developer) {
            continue;
          }

          // Get confidence for this identifier kind
          const confidence = Number(matchingIdentifier.confidence);

          // Add to duplicates map
          const existing = duplicatesMap.get(developer.developerId);
          const match = {
            kind: identifier.kind,
            value: identifier.valueNormalized,
            confidence,
          };

          if (existing) {
            existing.matches.push(match);
          } else {
            duplicatesMap.set(developer.developerId, {
              developer,
              matches: [match],
            });
          }
        }
      }

      // Get developer's primary_email for email matching
      const currentDevResult = await tx
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.developerId, developerId))
        .limit(1);

      const currentDev = currentDevResult[0];

      // Search for matching primary_email in other developers
      if (currentDev && currentDev.primaryEmail) {
        const matchingDevs = await tx
          .select()
          .from(schema.developers)
          .where(
            and(
              eq(schema.developers.tenantId, tenantId),
              eq(schema.developers.primaryEmail, currentDev.primaryEmail)
            )
          );

        for (const matchingDev of matchingDevs) {
          // Skip if it's the same developer
          if (matchingDev.developerId === developerId) {
            continue;
          }

          // Add to duplicates map
          const existing = duplicatesMap.get(matchingDev.developerId);
          const match = {
            kind: 'email',
            value: currentDev.primaryEmail,
            confidence: 1.0, // Email match = 100% confidence
          };

          if (existing) {
            existing.matches.push(match);
          } else {
            duplicatesMap.set(matchingDev.developerId, {
              developer: matchingDev,
              matches: [match],
            });
          }
        }
      }

      // 4. Calculate combined confidence for each duplicate
      const duplicates = Array.from(duplicatesMap.values()).map((entry) => {
        const confidences = entry.matches.map((m) => m.confidence);
        const combinedConfidence = combineConfidences(confidences);

        return {
          developer: entry.developer,
          confidence: combinedConfidence,
          matchedIdentifiers: entry.matches,
        };
      });

      // 5. Sort by confidence (highest first)
      duplicates.sort((a, b) => b.confidence - a.confidence);

      return duplicates;
    } catch (error) {
      console.error('Failed to find duplicates:', error);
      throw new Error('Failed to find duplicate developers');
    }
  });
}
