/**
 * Activity Type Service
 *
 * Provides CRUD operations for activity types with icons, colors, and funnel stage mapping.
 * All operations are tenant-scoped using withTenantContext() for RLS compliance.
 *
 * Functions:
 * - createActivityType: Create a new activity type
 * - getActivityTypeByAction: Get activity type by action name
 * - listActivityTypes: List all activity types for a tenant (with pagination)
 * - updateActivityType: Update an existing activity type
 * - deleteActivityType: Delete an activity type
 * - seedDefaultActivityTypes: Seed default activity types for a tenant
 */

import { eq, and, desc } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { CreateActivityType, UpdateActivityType, ListActivityTypes } from './activity-type.schemas.js';

/**
 * Create a new activity type
 *
 * @param tenantId - Tenant ID
 * @param data - Activity type data
 * @returns Created activity type
 * @throws Error if action already exists
 */
export async function createActivityType(
  tenantId: string,
  data: CreateActivityType
): Promise<typeof schema.activityTypes.$inferSelect> {
  return await withTenantContext(tenantId, async (tx) => {
    const [activityType] = await tx
      .insert(schema.activityTypes)
      .values({
        tenantId,
        action: data.action,
        iconName: data.iconName,
        colorClass: data.colorClass,
        stageKey: data.stageKey ?? null,
      })
      .returning();

    if (!activityType) {
      throw new Error('Failed to create activity type');
    }

    return activityType;
  });
}

/**
 * Get activity type by action
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action
 * @returns Activity type or null if not found
 */
export async function getActivityTypeByAction(
  tenantId: string,
  action: string
): Promise<typeof schema.activityTypes.$inferSelect | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [activityType] = await tx
      .select()
      .from(schema.activityTypes)
      .where(
        and(
          eq(schema.activityTypes.tenantId, tenantId),
          eq(schema.activityTypes.action, action)
        )
      )
      .limit(1);

    return activityType ?? null;
  });
}

/**
 * List all activity types for a tenant
 *
 * @param tenantId - Tenant ID
 * @param params - Pagination parameters
 * @returns List of activity types
 */
export async function listActivityTypes(
  tenantId: string,
  params: ListActivityTypes
): Promise<Array<typeof schema.activityTypes.$inferSelect>> {
  return await withTenantContext(tenantId, async (tx) => {
    const activityTypes = await tx
      .select()
      .from(schema.activityTypes)
      .where(eq(schema.activityTypes.tenantId, tenantId))
      .orderBy(desc(schema.activityTypes.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    return activityTypes;
  });
}

/**
 * Update an activity type
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action to update
 * @param data - Update data
 * @returns Updated activity type
 * @throws Error if activity type not found
 */
export async function updateActivityType(
  tenantId: string,
  action: string,
  data: UpdateActivityType
): Promise<typeof schema.activityTypes.$inferSelect> {
  return await withTenantContext(tenantId, async (tx) => {
    // Check if activity type exists
    const existing = await getActivityTypeByAction(tenantId, action);
    if (!existing) {
      throw new Error(`Activity type with action '${action}' not found`);
    }

    // Build update object (only include fields that are provided)
    const updateData: Partial<typeof schema.activityTypes.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.iconName !== undefined) {
      updateData.iconName = data.iconName;
    }

    if (data.colorClass !== undefined) {
      updateData.colorClass = data.colorClass;
    }

    if (data.stageKey !== undefined) {
      updateData.stageKey = data.stageKey;
    }

    // Perform update
    const [updated] = await tx
      .update(schema.activityTypes)
      .set(updateData)
      .where(
        and(
          eq(schema.activityTypes.tenantId, tenantId),
          eq(schema.activityTypes.action, action)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to update activity type');
    }

    return updated;
  });
}

/**
 * Delete an activity type
 *
 * @param tenantId - Tenant ID
 * @param action - Activity action to delete
 * @throws Error if activity type not found
 */
export async function deleteActivityType(
  tenantId: string,
  action: string
): Promise<void> {
  return await withTenantContext(tenantId, async (tx) => {
    // Check if activity type exists
    const existing = await getActivityTypeByAction(tenantId, action);
    if (!existing) {
      throw new Error(`Activity type with action '${action}' not found`);
    }

    // Perform delete
    await tx
      .delete(schema.activityTypes)
      .where(
        and(
          eq(schema.activityTypes.tenantId, tenantId),
          eq(schema.activityTypes.action, action)
        )
      );
  });
}

/**
 * Seed default activity types for a tenant
 *
 * Default types:
 * - click: heroicons:cursor-arrow-rays, text-blue-600 bg-blue-100 border-blue-200, awareness
 * - attend: heroicons:calendar-days, text-green-600 bg-green-100 border-green-200, engagement
 * - signup: heroicons:user-plus, text-purple-600 bg-purple-100 border-purple-200, engagement
 * - post: heroicons:chat-bubble-left-right, text-orange-600 bg-orange-100 border-orange-200, advocacy
 * - star: heroicons:star, text-yellow-600 bg-yellow-100 border-yellow-200, advocacy
 *
 * @param tenantId - Tenant ID
 */
export async function seedDefaultActivityTypes(tenantId: string): Promise<void> {
  const defaultTypes = [
    {
      action: 'click',
      iconName: 'heroicons:cursor-arrow-rays',
      colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
      stageKey: 'awareness' as const,
    },
    {
      action: 'attend',
      iconName: 'heroicons:calendar-days',
      colorClass: 'text-green-600 bg-green-100 border-green-200',
      stageKey: 'engagement' as const,
    },
    {
      action: 'signup',
      iconName: 'heroicons:user-plus',
      colorClass: 'text-purple-600 bg-purple-100 border-purple-200',
      stageKey: 'engagement' as const,
    },
    {
      action: 'post',
      iconName: 'heroicons:chat-bubble-left-right',
      colorClass: 'text-orange-600 bg-orange-100 border-orange-200',
      stageKey: 'advocacy' as const,
    },
    {
      action: 'star',
      iconName: 'heroicons:star',
      colorClass: 'text-yellow-600 bg-yellow-100 border-yellow-200',
      stageKey: 'advocacy' as const,
    },
  ];

  return await withTenantContext(tenantId, async (tx) => {
    for (const type of defaultTypes) {
      try {
        await tx
          .insert(schema.activityTypes)
          .values({
            tenantId,
            action: type.action,
            iconName: type.iconName,
            colorClass: type.colorClass,
            stageKey: type.stageKey,
          })
          .onConflictDoNothing(); // Idempotent: skip if already exists
      } catch (error) {
        // Ignore duplicate key errors (idempotency)
        if (error instanceof Error && error.message.includes('duplicate key')) {
          continue;
        }
        throw error;
      }
    }
  });
}
