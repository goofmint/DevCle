/**
 * DRM Service - Developer Relationship Management
 *
 * Provides business logic for developer management.
 * Handles CRUD operations, validation, and pagination.
 *
 * Architecture:
 * - Remix loader/action -> DRM Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - Validation is done using Zod schemas
 * - RLS (Row Level Security) is enforced at database level
 *
 * IMPORTANT: Before calling any service function, setTenantContext(tenantId)
 * must be called to set up RLS policy context. See Task 3.7 for details.
 */

import { getDb, setTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import { eq, and, or, like, count, asc, desc, type SQL } from 'drizzle-orm';

/**
 * Zod schema for creating a new developer
 *
 * Validates input data before database insertion.
 * All fields must match the database schema constraints.
 */
export const CreateDeveloperSchema = z.object({
  displayName: z.string().min(1).max(255),
  primaryEmail: z.string().email().nullable(),
  orgId: z.string().uuid().nullable(),
  consentAnalytics: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

/**
 * Input type for createDeveloper (raw/unvalidated data)
 *
 * This type represents data BEFORE validation.
 * Callers pass raw input, and the service validates it.
 */
export type CreateDeveloperInput = z.input<typeof CreateDeveloperSchema>;

/**
 * Output type after validation (defaults applied)
 *
 * This type represents data AFTER validation.
 * Used internally after calling schema.parse().
 */
export type CreateDeveloperData = z.infer<typeof CreateDeveloperSchema>;

/**
 * Zod schema for listing developers with pagination and sorting
 */
export const ListDevelopersSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  orgId: z.string().uuid().optional(),
  search: z.string().optional(),
  orderBy: z
    .enum(['displayName', 'primaryEmail', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Input type for listDevelopers (raw/unvalidated data)
 *
 * This type represents data BEFORE validation.
 * Callers pass raw input, and the service validates it.
 */
export type ListDevelopersInput = z.input<typeof ListDevelopersSchema>;

/**
 * Output type after validation (defaults applied)
 *
 * This type represents data AFTER validation.
 * Used internally after calling schema.parse().
 */
export type ListDevelopersParams = z.infer<typeof ListDevelopersSchema>;

/**
 * Zod schema for updating a developer
 *
 * All fields are optional (partial update support)
 */
export const UpdateDeveloperSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  primaryEmail: z.string().email().nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  consentAnalytics: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Type inferred from UpdateDeveloperSchema
 */
export type UpdateDeveloperInput = z.infer<typeof UpdateDeveloperSchema>;

/**
 * Create a new developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation (required for RLS)
 * @param data - Raw/unvalidated developer data (z.input type)
 * @returns Created developer record
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using CreateDeveloperSchema.parse(data)
 *    - This converts z.input → z.infer (applies defaults)
 * 2. Generate UUID for developer_id
 * 3. Insert into developers table using Drizzle ORM
 * 4. Return inserted record
 *
 * Example usage:
 * ```typescript
 * // Caller passes raw input (no defaults applied)
 * const result = await createDeveloper('default', {
 *   displayName: 'Alice',
 *   primaryEmail: 'alice@example.com',
 *   orgId: null,
 *   // consentAnalytics and tags are optional (defaults will be applied)
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function createDeveloper(
  tenantId: string,
  data: CreateDeveloperInput
): Promise<typeof schema.developers.$inferSelect> {
  // 1. Validate input data
  // This transforms z.input → z.infer (applies defaults: consentAnalytics=false, tags=[])
  const validated: CreateDeveloperData = CreateDeveloperSchema.parse(data);

  // 2. Set tenant context for RLS (MUST be called before any database operations)
  // This sets the session variable that RLS policies use to filter data
  await setTenantContext(tenantId);

  // 3. Get database connection
  const db = getDb();

  try {
    // 3. Insert into database using Drizzle ORM
    // RLS policy will automatically filter by tenant_id
    const [result] = await db
      .insert(schema.developers)
      .values({
        developerId: crypto.randomUUID(), // Generate UUID v4
        tenantId,
        displayName: validated.displayName,
        primaryEmail: validated.primaryEmail,
        orgId: validated.orgId,
        consentAnalytics: validated.consentAnalytics,
        tags: validated.tags,
      })
      .returning();

    // 4. Return created record
    // TypeScript ensures result exists because .returning() always returns array
    if (!result) {
      throw new Error('Failed to create developer: No record returned');
    }

    return result;
  } catch (error) {
    // Handle database-specific errors
    if (error instanceof Error) {
      // Check for unique constraint violation (duplicate email)
      if (error.message.includes('duplicate key')) {
        throw new Error('Developer with this email already exists');
      }
      // Check for foreign key constraint violation (invalid orgId)
      if (error.message.includes('foreign key')) {
        throw new Error('Referenced organization does not exist');
      }
    }

    // Log unexpected errors for debugging
    console.error('Failed to create developer:', error);
    throw new Error('Failed to create developer due to database error');
  }
}

/**
 * Get a single developer by ID
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to retrieve
 * @returns Developer record or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query developers table by developer_id
 * 2. RLS automatically filters by tenant_id
 * 3. Return null if not found (not an error)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function getDeveloper(
  tenantId: string,
  developerId: string
): Promise<typeof schema.developers.$inferSelect | null> {
  // Set tenant context for RLS (MUST be called before any database operations)
  await setTenantContext(tenantId);

  const db = getDb();

  try {
    // Query by developer_id
    // RLS policy will automatically filter by tenant_id
    const result = await db
      .select()
      .from(schema.developers)
      .where(eq(schema.developers.developerId, developerId))
      .limit(1);

    // Return null if not found (this is expected behavior, not an error)
    return result[0] ?? null;
  } catch (error) {
    // Log unexpected errors
    console.error('Failed to get developer:', error);
    throw new Error('Failed to retrieve developer from database');
  }
}

/**
 * List developers with pagination and sorting
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param params - Raw/unvalidated pagination, filter, and sort parameters (z.input type)
 * @returns Object containing developers array and total count
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate params using ListDevelopersSchema.parse(params)
 *    - This converts z.input → z.infer (applies defaults for limit/offset/orderBy/orderDirection)
 * 2. Build query with filters (orgId, search)
 * 3. Apply sorting (orderBy, orderDirection)
 * 4. Apply pagination (limit, offset)
 * 5. Execute query and count query in parallel
 * 6. Return { developers, total }
 *
 * Filters:
 * - orgId: Filter by organization ID
 * - search: Search in display_name and primary_email (case-insensitive)
 *
 * Pagination:
 * - limit: Number of records to return (max 100, default 50)
 * - offset: Number of records to skip (default 0)
 *
 * Sorting:
 * - orderBy: Field to sort by ('displayName', 'primaryEmail', 'createdAt', 'updatedAt', default: 'createdAt')
 * - orderDirection: Sort direction ('asc', 'desc', default: 'desc')
 *
 * Example usage:
 * ```typescript
 * // Caller passes raw input (defaults will be applied)
 * const result = await listDevelopers('default', {
 *   // limit, offset, orderBy, orderDirection are optional
 *   // Defaults: limit=50, offset=0, orderBy='createdAt', orderDirection='desc'
 *   orgId: '20000000-0000-4000-8000-000000000001',
 *   orderBy: 'displayName',
 *   orderDirection: 'asc',
 * });
 * ```
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function listDevelopers(
  tenantId: string,
  params: ListDevelopersInput
): Promise<{
  developers: Array<typeof schema.developers.$inferSelect>;
  total: number;
}> {
  // 1. Validate and apply defaults
  const validated: ListDevelopersParams = ListDevelopersSchema.parse(params);

  // 2. Set tenant context for RLS (MUST be called before any database operations)
  await setTenantContext(tenantId);

  const db = getDb();

  try {
    // 2. Build WHERE conditions
    const whereConditions: SQL[] = [];

    // Filter by organization ID if provided
    if (validated.orgId) {
      whereConditions.push(eq(schema.developers.orgId, validated.orgId));
    }

    // Search in displayName and primaryEmail (case-insensitive)
    if (validated.search) {
      const searchPattern = `%${validated.search}%`;
      whereConditions.push(
        or(
          like(schema.developers.displayName, searchPattern),
          like(schema.developers.primaryEmail, searchPattern)
        ) as SQL
      );
    }

    // Combine conditions with AND (RLS will add tenant_id filter automatically)
    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 3. Determine sort column
    const sortColumn =
      validated.orderBy === 'displayName'
        ? schema.developers.displayName
        : validated.orderBy === 'primaryEmail'
        ? schema.developers.primaryEmail
        : validated.orderBy === 'updatedAt'
        ? schema.developers.updatedAt
        : schema.developers.createdAt;

    // Determine sort direction
    const sortOrder = validated.orderDirection === 'asc' ? asc : desc;

    // 4. Execute data query and count query in parallel
    const [developers, countResult] = await Promise.all([
      // Data query with sorting and pagination
      db
        .select()
        .from(schema.developers)
        .where(whereClause)
        .orderBy(sortOrder(sortColumn))
        .limit(validated.limit)
        .offset(validated.offset),

      // Count query (without limit/offset/order)
      db
        .select({ count: count() })
        .from(schema.developers)
        .where(whereClause),
    ]);

    // 5. Return results
    return {
      developers,
      total: countResult[0]?.count ?? 0,
    };
  } catch (error) {
    console.error('Failed to list developers:', error);
    throw new Error('Failed to retrieve developers from database');
  }
}

/**
 * Update an existing developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to update
 * @param data - Developer data to update (partial update supported)
 * @returns Updated developer record or null if not found
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateDeveloperSchema
 * 2. Query developer by developer_id (RLS applies)
 * 3. If not found, return null
 * 4. Update only provided fields using Drizzle ORM
 * 5. Return updated record
 *
 * Partial Update Support:
 * - Allows updating only specific fields
 * - Null values are treated as "set to null" (not "skip")
 * - Empty object {} is allowed (no-op, returns existing record)
 *
 * Examples:
 * - Update email only: { primaryEmail: 'new@example.com' }
 * - Update tags only: { tags: ['backend', 'python'] }
 * - Clear organization: { orgId: null }
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function updateDeveloper(
  tenantId: string,
  developerId: string,
  data: UpdateDeveloperInput
): Promise<typeof schema.developers.$inferSelect | null> {
  // 1. Validate input
  const validated: UpdateDeveloperInput = UpdateDeveloperSchema.parse(data);

  // 2. Set tenant context for RLS (MUST be called before any database operations)
  // Note: getDeveloper also sets tenant context, but we set it here explicitly
  // to ensure it's set even if getDeveloper's implementation changes
  await setTenantContext(tenantId);

  // 3. Check if developer exists
  const existing = await getDeveloper(tenantId, developerId);
  if (!existing) {
    return null; // Not found
  }

  // 3. If no fields to update, return existing record (no-op)
  if (Object.keys(validated).length === 0) {
    return existing;
  }

  const db = getDb();

  try {
    // 4. Update record using Drizzle ORM
    // RLS policy will automatically filter by tenant_id
    const [result] = await db
      .update(schema.developers)
      .set({
        ...validated,
        // updatedAt is automatically updated by database trigger
      })
      .where(eq(schema.developers.developerId, developerId))
      .returning();

    // 5. Return updated record
    if (!result) {
      throw new Error('Failed to update developer: No record returned');
    }

    return result;
  } catch (error) {
    // Handle database-specific errors
    if (error instanceof Error) {
      // Check for unique constraint violation (duplicate email)
      if (error.message.includes('duplicate key')) {
        throw new Error('Developer with this email already exists');
      }
      // Check for foreign key constraint violation (invalid orgId)
      if (error.message.includes('foreign key')) {
        throw new Error('Referenced organization does not exist');
      }
    }

    // Log unexpected errors
    console.error('Failed to update developer:', error);
    throw new Error('Failed to update developer due to database error');
  }
}

/**
 * Delete a developer
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param developerId - UUID of the developer to delete
 * @returns True if deleted, false if not found
 * @throws {Error} If database error occurs
 *
 * Implementation details:
 * 1. Query developer by developer_id (RLS applies)
 * 2. If not found, return false
 * 3. Delete developer record using Drizzle ORM
 * 4. Return true
 *
 * Important Notes:
 * - This is a HARD DELETE (permanent removal)
 * - Related records (accounts, activities) should be handled by:
 *   a) Database CASCADE constraints (automatic deletion)
 *   b) OR: Set developer_id to NULL (orphan records)
 *   c) OR: Soft delete (set deleted_at timestamp) - preferred for GDPR compliance
 *
 * GDPR Considerations:
 * - Users have "right to erasure" (right to be forgotten)
 * - Hard delete may be required for GDPR compliance
 * - Consider soft delete for audit trail requirements
 *
 * Alternative: Soft Delete
 * - Add `deleted_at` timestamp column to schema
 * - Set deleted_at = NOW() instead of DELETE
 * - Filter out deleted records in queries (WHERE deleted_at IS NULL)
 *
 * RLS: Requires app.current_tenant_id to be set in session
 */
export async function deleteDeveloper(
  tenantId: string,
  developerId: string
): Promise<boolean> {
  // 1. Set tenant context for RLS (MUST be called before any database operations)
  // Note: getDeveloper also sets tenant context, but we set it here explicitly
  await setTenantContext(tenantId);

  // 2. Check if developer exists
  const existing = await getDeveloper(tenantId, developerId);
  if (!existing) {
    return false; // Not found
  }

  const db = getDb();

  try {
    // 2. Delete record using Drizzle ORM
    // RLS policy will automatically filter by tenant_id
    await db
      .delete(schema.developers)
      .where(eq(schema.developers.developerId, developerId));

    // 3. Return success
    return true;
  } catch (error) {
    // Log unexpected errors
    console.error('Failed to delete developer:', error);
    throw new Error('Failed to delete developer from database');
  }
}
