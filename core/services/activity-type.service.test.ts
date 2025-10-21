/**
 * Activity Type Service Tests
 *
 * Comprehensive tests for activity type CRUD operations.
 * All tests use real database with RLS enforcement via withTenantContext().
 *
 * Test coverage:
 * - Create activity type (success, duplicate action)
 * - Get activity type by action (found, not found)
 * - List activity types (pagination, ordering)
 * - Update activity type (success, not found, partial updates)
 * - Delete activity type (success, not found)
 * - Seed default activity types (success, idempotency)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runInTenant, ensureTenantExists } from '../db/tenant-test-utils.js';
import * as schema from '../db/schema/index.js';
import {
  createActivityType,
  getActivityTypeByAction,
  listActivityTypes,
  updateActivityType,
  deleteActivityType,
  seedDefaultActivityTypes,
} from './activity-type.service.js';

const TEST_TENANT_ID = 'test-activity-types';

describe('Activity Type Service', () => {
  beforeEach(async () => {
    await ensureTenantExists(TEST_TENANT_ID);

    // Clean up activity_types table
    await runInTenant(TEST_TENANT_ID, async (tx) => {
      await tx.delete(schema.activityTypes);
    });
  });

  describe('createActivityType', () => {
    it('should create an activity type with all fields', async () => {
      const result = await createActivityType(TEST_TENANT_ID, {
        action: 'contribute',
        iconName: 'heroicons:code-bracket',
        colorClass: 'text-indigo-600 bg-indigo-100 border-indigo-200',
        stageKey: 'engagement',
      });

      expect(result).toMatchObject({
        tenantId: TEST_TENANT_ID,
        action: 'contribute',
        iconName: 'heroicons:code-bracket',
        colorClass: 'text-indigo-600 bg-indigo-100 border-indigo-200',
        stageKey: 'engagement',
      });
      expect(result.activityTypeId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create an activity type with default iconName and colorClass', async () => {
      const result = await createActivityType(TEST_TENANT_ID, {
        action: 'download',
        iconName: 'heroicons:bolt',
        colorClass: 'text-gray-600 bg-gray-100 border-gray-200',
        stageKey: null,
      });

      expect(result).toMatchObject({
        action: 'download',
        iconName: 'heroicons:bolt',
        colorClass: 'text-gray-600 bg-gray-100 border-gray-200',
        stageKey: null,
      });
    });

    it('should create an activity type without stageKey', async () => {
      const result = await createActivityType(TEST_TENANT_ID, {
        action: 'view',
        iconName: 'heroicons:eye',
        colorClass: 'text-gray-600 bg-gray-100 border-gray-200',
        stageKey: undefined,
      });

      expect(result.stageKey).toBeNull();
    });

    it('should throw error when creating duplicate action', async () => {
      await createActivityType(TEST_TENANT_ID, {
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });

      await expect(
        createActivityType(TEST_TENANT_ID, {
          action: 'click',
          iconName: 'heroicons:cursor-arrow-ripple',
          colorClass: 'text-red-600 bg-red-100 border-red-200',
          stageKey: 'awareness',
        })
      ).rejects.toThrow();
    });
  });

  describe('getActivityTypeByAction', () => {
    it('should return activity type when found', async () => {
      await createActivityType(TEST_TENANT_ID, {
        action: 'attend',
        iconName: 'heroicons:calendar-days',
        colorClass: 'text-green-600 bg-green-100 border-green-200',
        stageKey: 'engagement',
      });

      const result = await getActivityTypeByAction(TEST_TENANT_ID, 'attend');

      expect(result).toMatchObject({
        action: 'attend',
        iconName: 'heroicons:calendar-days',
        colorClass: 'text-green-600 bg-green-100 border-green-200',
        stageKey: 'engagement',
      });
    });

    it('should return null when not found', async () => {
      const result = await getActivityTypeByAction(TEST_TENANT_ID, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listActivityTypes', () => {
    beforeEach(async () => {
      // Create multiple activity types
      await createActivityType(TEST_TENANT_ID, {
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });
      await createActivityType(TEST_TENANT_ID, {
        action: 'attend',
        iconName: 'heroicons:calendar-days',
        colorClass: 'text-green-600 bg-green-100 border-green-200',
        stageKey: 'engagement',
      });
      await createActivityType(TEST_TENANT_ID, {
        action: 'signup',
        iconName: 'heroicons:user-plus',
        colorClass: 'text-purple-600 bg-purple-100 border-purple-200',
        stageKey: 'engagement',
      });
    });

    it('should list all activity types', async () => {
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 0 });

      expect(result).toHaveLength(3);
      expect(result.map((at) => at.action)).toEqual(['signup', 'attend', 'click']);
    });

    it('should respect limit parameter', async () => {
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 2, offset: 0 });

      expect(result).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 1 });

      expect(result).toHaveLength(2);
      expect(result.map((at) => at.action)).toEqual(['attend', 'click']);
    });

    it('should return empty array when offset exceeds total', async () => {
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 100 });

      expect(result).toHaveLength(0);
    });

    it('should order by created_at desc', async () => {
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 0 });

      // signup was created last, so it should be first
      expect(result[0]?.action).toBe('signup');
      expect(result[2]?.action).toBe('click');
    });
  });

  describe('updateActivityType', () => {
    beforeEach(async () => {
      await createActivityType(TEST_TENANT_ID, {
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });
    });

    it('should update icon name', async () => {
      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        iconName: 'heroicons:cursor-arrow-ripple',
      });

      expect(result.iconName).toBe('heroicons:cursor-arrow-ripple');
      expect(result.colorClass).toBe('text-blue-600 bg-blue-100 border-blue-200'); // Unchanged
      expect(result.stageKey).toBe('awareness'); // Unchanged
    });

    it('should update color class', async () => {
      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        colorClass: 'text-red-600 bg-red-100 border-red-200',
      });

      expect(result.colorClass).toBe('text-red-600 bg-red-100 border-red-200');
      expect(result.iconName).toBe('heroicons:cursor-arrow-rays'); // Unchanged
      expect(result.stageKey).toBe('awareness'); // Unchanged
    });

    it('should update stage key', async () => {
      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        stageKey: 'engagement',
      });

      expect(result.stageKey).toBe('engagement');
      expect(result.iconName).toBe('heroicons:cursor-arrow-rays'); // Unchanged
      expect(result.colorClass).toBe('text-blue-600 bg-blue-100 border-blue-200'); // Unchanged
    });

    it('should update stage key to null', async () => {
      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        stageKey: null,
      });

      expect(result.stageKey).toBeNull();
    });

    it('should update all fields', async () => {
      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        iconName: 'heroicons:cursor-arrow-ripple',
        colorClass: 'text-red-600 bg-red-100 border-red-200',
        stageKey: 'engagement',
      });

      expect(result).toMatchObject({
        iconName: 'heroicons:cursor-arrow-ripple',
        colorClass: 'text-red-600 bg-red-100 border-red-200',
        stageKey: 'engagement',
      });
    });

    it('should update updatedAt timestamp', async () => {
      const before = await getActivityTypeByAction(TEST_TENANT_ID, 'click');
      const originalUpdatedAt = before?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await updateActivityType(TEST_TENANT_ID, 'click', {
        iconName: 'heroicons:cursor-arrow-ripple',
      });

      expect(result.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
    });

    it('should throw error when activity type not found', async () => {
      await expect(
        updateActivityType(TEST_TENANT_ID, 'nonexistent', {
          iconName: 'heroicons:bolt',
        })
      ).rejects.toThrow("Activity type with action 'nonexistent' not found");
    });
  });

  describe('deleteActivityType', () => {
    beforeEach(async () => {
      await createActivityType(TEST_TENANT_ID, {
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });
    });

    it('should delete activity type', async () => {
      await deleteActivityType(TEST_TENANT_ID, 'click');

      const result = await getActivityTypeByAction(TEST_TENANT_ID, 'click');
      expect(result).toBeNull();
    });

    it('should throw error when activity type not found', async () => {
      await expect(deleteActivityType(TEST_TENANT_ID, 'nonexistent')).rejects.toThrow(
        "Activity type with action 'nonexistent' not found"
      );
    });
  });

  describe('seedDefaultActivityTypes', () => {
    it('should seed all 5 default activity types', async () => {
      await seedDefaultActivityTypes(TEST_TENANT_ID);

      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 0 });

      expect(result).toHaveLength(5);
      expect(result.map((at) => at.action).sort()).toEqual([
        'attend',
        'click',
        'post',
        'signup',
        'star',
      ]);
    });

    it('should seed with correct default values', async () => {
      await seedDefaultActivityTypes(TEST_TENANT_ID);

      const click = await getActivityTypeByAction(TEST_TENANT_ID, 'click');
      expect(click).toMatchObject({
        action: 'click',
        iconName: 'heroicons:cursor-arrow-rays',
        colorClass: 'text-blue-600 bg-blue-100 border-blue-200',
        stageKey: 'awareness',
      });

      const attend = await getActivityTypeByAction(TEST_TENANT_ID, 'attend');
      expect(attend).toMatchObject({
        action: 'attend',
        iconName: 'heroicons:calendar-days',
        colorClass: 'text-green-600 bg-green-100 border-green-200',
        stageKey: 'engagement',
      });

      const signup = await getActivityTypeByAction(TEST_TENANT_ID, 'signup');
      expect(signup).toMatchObject({
        action: 'signup',
        iconName: 'heroicons:user-plus',
        colorClass: 'text-purple-600 bg-purple-100 border-purple-200',
        stageKey: 'engagement',
      });

      const post = await getActivityTypeByAction(TEST_TENANT_ID, 'post');
      expect(post).toMatchObject({
        action: 'post',
        iconName: 'heroicons:chat-bubble-left-right',
        colorClass: 'text-orange-600 bg-orange-100 border-orange-200',
        stageKey: 'advocacy',
      });

      const star = await getActivityTypeByAction(TEST_TENANT_ID, 'star');
      expect(star).toMatchObject({
        action: 'star',
        iconName: 'heroicons:star',
        colorClass: 'text-yellow-600 bg-yellow-100 border-yellow-200',
        stageKey: 'advocacy',
      });
    });

    it('should be idempotent (can run multiple times)', async () => {
      await seedDefaultActivityTypes(TEST_TENANT_ID);
      await seedDefaultActivityTypes(TEST_TENANT_ID); // Second run

      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 0 });

      // Should still have only 5 activity types (no duplicates)
      expect(result).toHaveLength(5);
    });

    it('should not overwrite existing custom activity types', async () => {
      // Create custom activity type with same action name
      await createActivityType(TEST_TENANT_ID, {
        action: 'click',
        iconName: 'heroicons:cursor-arrow-ripple',
        colorClass: 'text-red-600 bg-red-100 border-red-200',
        stageKey: null,
      });

      await seedDefaultActivityTypes(TEST_TENANT_ID);

      const click = await getActivityTypeByAction(TEST_TENANT_ID, 'click');
      // Should keep custom values (not overwritten by seed)
      expect(click).toMatchObject({
        iconName: 'heroicons:cursor-arrow-ripple',
        colorClass: 'text-red-600 bg-red-100 border-red-200',
        stageKey: null,
      });

      // Other default types should be created
      const result = await listActivityTypes(TEST_TENANT_ID, { limit: 50, offset: 0 });
      expect(result).toHaveLength(5);
    });
  });
});
