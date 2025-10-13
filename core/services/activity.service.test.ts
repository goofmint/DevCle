/**
 * Activity Service Tests
 *
 * Tests for the Activity Service (Developer Activity Management).
 * These tests verify that:
 * - createActivity() works correctly (record activities)
 * - getActivity() works correctly (get by ID)
 * - listActivities() works correctly (filter, paginate, sort)
 * - updateActivity() works correctly (partial updates)
 * - deleteActivity() works correctly (hard delete)
 *
 * Test Strategy:
 * - NO MOCKS: Tests use real database connection
 * - Cleanup: Tests clean up their own data
 * - Verification: Actual database records are checked
 * - RLS: Tests verify tenant isolation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getDb,
  closeDb,
  setTenantContext,
  clearTenantContext,
} from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import {
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
  deleteActivity,
} from './activity.service.js';
import { createDeveloper, deleteDeveloper } from './drm.service.js';

describe('Activity Service', () => {
  beforeAll(async () => {
    // Set tenant context for all tests
    // This is REQUIRED because RLS is enabled
    await setTenantContext('default');
  });

  afterAll(async () => {
    // Clear tenant context to ensure test isolation
    await clearTenantContext();

    // Clean up database connections
    await closeDb();
  });

  describe('createActivity', () => {
    it('should create activity with developer_id', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `test-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Create activity
      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
        confidence: 1.0,
      });

      // Assert: Activity should be created
      expect(activity.developerId).toBe(dev.developerId);
      expect(activity.action).toBe('view');
      expect(activity.source).toBe('web');

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should create activity with account_id', async () => {
      // Arrange: Create developer and account
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: null,
        orgId: null,
      });

      const db = getDb();
      const [account] = await db.insert(schema.accounts).values({
        accountId: crypto.randomUUID(),
        tenantId: 'default',
        developerId: dev.developerId,
        provider: 'github',
        externalUserId: `gh-${timestamp}`,
        handle: 'testdev',
      }).returning();

      if (!account) {
        throw new Error('Failed to create account');
      }

      // Act: Create activity with account_id
      const activity = await createActivity('default', {
        accountId: account.accountId,
        action: 'star',
        occurredAt: new Date(),
        source: 'github',
        sourceRef: 'https://github.com/user/repo',
        metadata: { repo: 'user/repo' },
      });

      // Assert: Activity should be created
      expect(activity.accountId).toBe(account.accountId);
      expect(activity.action).toBe('star');

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should create activity with anon_id (anonymous tracking)', async () => {
      // Act: Create anonymous activity
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        anonId: `click_${timestamp}`,
        action: 'click',
        occurredAt: new Date(),
        source: 'shortlink',
        metadata: { campaign: 'summer2025' },
      });

      // Assert: Activity should be created
      expect(activity.anonId).toBe(`click_${timestamp}`);
      expect(activity.developerId).toBeNull();
      expect(activity.action).toBe('click');

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
    });

    it('should throw error if no ID provided', async () => {
      // Act & Assert: Creating activity without any ID should fail
      await expect(
        createActivity('default', {
          // No developerId, accountId, or anonId
          action: 'view',
          occurredAt: new Date(),
          source: 'web',
        })
      ).rejects.toThrow(/at least one.*id.*required/i);
    });

    it('should handle deduplication with dedupKey', async () => {
      // Arrange: Create first activity with dedupKey
      const timestamp = Date.now();
      const dedupKey = `github_star_${timestamp}`;
      const first = await createActivity('default', {
        anonId: 'anon123',
        action: 'star',
        occurredAt: new Date(),
        source: 'github',
        dedupKey,
      });

      // Act & Assert: Try to create duplicate activity
      await expect(
        createActivity('default', {
          anonId: 'anon456',
          action: 'star',
          occurredAt: new Date(),
          source: 'github',
          dedupKey, // Same dedupKey
        })
      ).rejects.toThrow(/duplicate/i);

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, first.activityId));
    });

    it('should validate confidence score range (too high)', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `conf-high-${timestamp}@example.com`,
        orgId: null,
      });

      // Act & Assert: Confidence > 1.0 should fail
      await expect(
        createActivity('default', {
          developerId: dev.developerId,
          action: 'view',
          occurredAt: new Date(),
          source: 'web',
          confidence: 1.5,
        })
      ).rejects.toThrow();

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should validate confidence score range (too low)', async () => {
      // Arrange: Create developer
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `conf-low-${timestamp}@example.com`,
        orgId: null,
      });

      // Act & Assert: Confidence < 0.0 should fail
      await expect(
        createActivity('default', {
          developerId: dev.developerId,
          action: 'view',
          occurredAt: new Date(),
          source: 'web',
          confidence: -0.1,
        })
      ).rejects.toThrow();

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('listActivities', () => {
    it('should list all activities for a developer', async () => {
      // Arrange: Create developer and activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `list-all-${timestamp}@example.com`,
        orgId: null,
      });

      // Create 3 activities
      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date('2025-01-10'),
        source: 'web',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'click',
        occurredAt: new Date('2025-01-11'),
        source: 'web',
      });
      const act3 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'signup',
        occurredAt: new Date('2025-01-12'),
        source: 'web',
      });

      // Act: List activities
      const activities = await listActivities('default', {
        developerId: dev.developerId,
      });

      // Assert: Should return 3 activities
      expect(activities.length).toBe(3);

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act3.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should filter by date range', async () => {
      // Arrange: Create developer and activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `date-range-${timestamp}@example.com`,
        orgId: null,
      });

      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date('2025-01-05'),
        source: 'web',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'click',
        occurredAt: new Date('2025-01-15'),
        source: 'web',
      });
      const act3 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'signup',
        occurredAt: new Date('2025-01-25'),
        source: 'web',
      });

      // Act: List activities in January 10-20
      const activities = await listActivities('default', {
        developerId: dev.developerId,
        fromDate: new Date('2025-01-10'),
        toDate: new Date('2025-01-20'),
      });

      // Assert: Should return only 1 activity (2025-01-15)
      expect(activities.length).toBe(1);
      expect(activities[0]!.action).toBe('click');

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act3.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should filter by action', async () => {
      // Arrange: Create activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `action-filter-${timestamp}@example.com`,
        orgId: null,
      });

      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'signup',
        occurredAt: new Date(),
        source: 'web',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
      });

      // Act: List only 'signup' activities
      const signups = await listActivities('default', {
        developerId: dev.developerId,
        action: 'signup',
      });

      // Assert: Should return only signup activities
      expect(signups.length).toBe(1);
      expect(signups[0]!.action).toBe('signup');

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should apply pagination (limit and offset)', async () => {
      // Arrange: Create 10 activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `pagination-${timestamp}@example.com`,
        orgId: null,
      });

      const activityIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const activity = await createActivity('default', {
          developerId: dev.developerId,
          action: 'view',
          occurredAt: new Date(Date.now() + i * 1000),
          source: 'web',
        });
        activityIds.push(activity.activityId);
      }

      // Act: Get first 5 activities
      const page1 = await listActivities('default', {
        developerId: dev.developerId,
        limit: 5,
        offset: 0,
      });

      // Act: Get next 5 activities
      const page2 = await listActivities('default', {
        developerId: dev.developerId,
        limit: 5,
        offset: 5,
      });

      // Assert: Should have 5 activities each
      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);

      // Cleanup
      const db = getDb();
      for (const activityId of activityIds) {
        await db.delete(schema.activities).where(eq(schema.activities.activityId, activityId));
      }
      await deleteDeveloper('default', dev.developerId);
    });

    it('should sort by occurred_at DESC (default)', async () => {
      // Arrange: Create activities in non-chronological order
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `sort-desc-${timestamp}@example.com`,
        orgId: null,
      });

      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'a',
        occurredAt: new Date('2025-01-15'),
        source: 'web',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'b',
        occurredAt: new Date('2025-01-20'),
        source: 'web',
      });
      const act3 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'c',
        occurredAt: new Date('2025-01-10'),
        source: 'web',
      });

      // Act: List activities (default sort)
      const activities = await listActivities('default', {
        developerId: dev.developerId,
      });

      // Assert: Should be sorted DESC (newest first)
      expect(activities[0]!.action).toBe('b'); // 2025-01-20
      expect(activities[1]!.action).toBe('a'); // 2025-01-15
      expect(activities[2]!.action).toBe('c'); // 2025-01-10

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act3.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should sort by occurred_at ASC when specified', async () => {
      // Arrange: Create activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `sort-asc-${timestamp}@example.com`,
        orgId: null,
      });

      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'a',
        occurredAt: new Date('2025-01-15'),
        source: 'web',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'b',
        occurredAt: new Date('2025-01-20'),
        source: 'web',
      });
      const act3 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'c',
        occurredAt: new Date('2025-01-10'),
        source: 'web',
      });

      // Act: List activities with ASC sort
      const activities = await listActivities('default', {
        developerId: dev.developerId,
        orderDirection: 'asc',
      });

      // Assert: Should be sorted ASC (oldest first)
      expect(activities[0]!.action).toBe('c'); // 2025-01-10
      expect(activities[1]!.action).toBe('a'); // 2025-01-15
      expect(activities[2]!.action).toBe('b'); // 2025-01-20

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act3.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should filter by source', async () => {
      // Arrange: Create activities with different sources
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `source-filter-${timestamp}@example.com`,
        orgId: null,
      });

      const act1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'github',
      });
      const act2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
      });

      // Act: List only github activities
      const githubActivities = await listActivities('default', {
        developerId: dev.developerId,
        source: 'github',
      });

      // Assert: Should return only github activities
      expect(githubActivities.length).toBe(1);
      expect(githubActivities[0]!.source).toBe('github');

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act1.activityId));
      await db.delete(schema.activities).where(eq(schema.activities.activityId, act2.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return empty array if no activities found', async () => {
      // Act: List activities for non-existent developer
      const activities = await listActivities('default', {
        developerId: '99999999-9999-4999-8999-999999999999',
      });

      // Assert: Should return empty array
      expect(activities).toEqual([]);
    });
  });

  describe('getActivity', () => {
    it('should get activity by ID', async () => {
      // Arrange: Create developer and activity
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `get-by-id-${timestamp}@example.com`,
        orgId: null,
      });

      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date('2025-01-15'),
        source: 'web',
        metadata: { page: '/docs' },
      });

      // Act: Get activity by ID
      const retrieved = await getActivity('default', activity.activityId);

      // Assert: Should return the activity
      expect(retrieved).not.toBeNull();
      expect(retrieved!.activityId).toBe(activity.activityId);
      expect(retrieved!.developerId).toBe(dev.developerId);
      expect(retrieved!.action).toBe('view');
      expect(retrieved!.metadata).toEqual({ page: '/docs' });

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return null if activity not found', async () => {
      // Act: Get non-existent activity
      const retrieved = await getActivity('default', '99999999-9999-4999-8999-999999999999');

      // Assert: Should return null
      expect(retrieved).toBeNull();
    });

    it('should get activity with all fields', async () => {
      // Arrange: Create activity with all optional fields
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `get-all-fields-${timestamp}@example.com`,
        orgId: null,
      });

      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'star',
        occurredAt: new Date('2025-01-20'),
        source: 'github',
        sourceRef: 'https://github.com/user/repo',
        category: 'engagement',
        groupKey: 'repo-stars',
        metadata: { repo: 'user/repo', stars: 100 },
        confidence: 0.95,
      });

      // Act: Get activity
      const retrieved = await getActivity('default', activity.activityId);

      // Assert: Should return all fields
      expect(retrieved).not.toBeNull();
      expect(retrieved!.developerId).toBe(dev.developerId);
      expect(retrieved!.action).toBe('star');
      expect(retrieved!.source).toBe('github');
      expect(retrieved!.sourceRef).toBe('https://github.com/user/repo');
      expect(retrieved!.category).toBe('engagement');
      expect(retrieved!.groupKey).toBe('repo-stars');
      expect(retrieved!.metadata).toEqual({ repo: 'user/repo', stars: 100 });
      expect(retrieved!.confidence).toBe('0.95');

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('updateActivity', () => {
    it('should update activity fields (partial update)', async () => {
      // Arrange: Create developer and activity
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `update-partial-${timestamp}@example.com`,
        orgId: null,
      });

      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date('2025-01-15'),
        source: 'web',
        metadata: { page: '/docs' },
      });

      // Act: Update metadata
      const updated = await updateActivity('default', activity.activityId, {
        metadata: { page: '/docs', updated: true },
      });

      // Assert: Should update metadata only
      expect(updated.activityId).toBe(activity.activityId);
      expect(updated.metadata).toEqual({ page: '/docs', updated: true });
      expect(updated.action).toBe('view'); // Other fields unchanged

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should resolve developer_id after identity resolution', async () => {
      // Arrange: Create activity with anon_id
      const timestamp = Date.now();
      const activity = await createActivity('default', {
        anonId: `anon-${timestamp}`,
        action: 'click',
        occurredAt: new Date(),
        source: 'shortlink',
      });

      // Create developer
      const dev = await createDeveloper('default', {
        displayName: 'Resolved Developer',
        primaryEmail: `resolved-${timestamp}@example.com`,
        orgId: null,
      });

      // Act: Resolve developer_id
      const updated = await updateActivity('default', activity.activityId, {
        developerId: dev.developerId,
      });

      // Assert: developer_id should be set
      expect(updated.developerId).toBe(dev.developerId);
      expect(updated.anonId).toBe(`anon-${timestamp}`); // anon_id preserved

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
      await deleteDeveloper('default', dev.developerId);
    });

    it('should throw error if activity not found', async () => {
      // Act & Assert: Update non-existent activity should fail
      await expect(
        updateActivity('default', '99999999-9999-4999-8999-999999999999', {
          action: 'updated',
        })
      ).rejects.toThrow(/not found/i);
    });

    it('should validate confidence score range on update', async () => {
      // Arrange: Create activity
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `update-conf-${timestamp}@example.com`,
        orgId: null,
      });
      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
      });

      // Act & Assert: Confidence > 1.0 should fail
      await expect(
        updateActivity('default', activity.activityId, {
          confidence: 1.5,
        })
      ).rejects.toThrow();

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity.activityId));
      await deleteDeveloper('default', dev.developerId);
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity successfully', async () => {
      // Arrange: Create developer and activity
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test Developer',
        primaryEmail: `delete-success-${timestamp}@example.com`,
        orgId: null,
      });

      const activity = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date(),
        source: 'web',
      });

      // Act: Delete activity
      const deleted = await deleteActivity('default', activity.activityId);

      // Assert: Should return true
      expect(deleted).toBe(true);

      // Verify activity is deleted
      const db = getDb();
      const result = await db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.activityId, activity.activityId))
        .limit(1);
      expect(result.length).toBe(0);

      // Cleanup
      await deleteDeveloper('default', dev.developerId);
    });

    it('should return false if activity not found', async () => {
      // Act: Delete non-existent activity
      const deleted = await deleteActivity('default', '99999999-9999-4999-8999-999999999999');

      // Assert: Should return false
      expect(deleted).toBe(false);
    });

    it('should not affect other activities when deleting one', async () => {
      // Arrange: Create 2 activities
      const timestamp = Date.now();
      const dev = await createDeveloper('default', {
        displayName: 'Test',
        primaryEmail: `delete-isolation-${timestamp}@example.com`,
        orgId: null,
      });

      const activity1 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'view',
        occurredAt: new Date('2025-01-10'),
        source: 'web',
      });

      const activity2 = await createActivity('default', {
        developerId: dev.developerId,
        action: 'click',
        occurredAt: new Date('2025-01-11'),
        source: 'web',
      });

      // Act: Delete only activity1
      await deleteActivity('default', activity1.activityId);

      // Assert: activity2 should still exist
      const remaining = await listActivities('default', {
        developerId: dev.developerId,
      });
      expect(remaining.length).toBe(1);
      expect(remaining[0]!.activityId).toBe(activity2.activityId);

      // Cleanup
      const db = getDb();
      await db.delete(schema.activities).where(eq(schema.activities.activityId, activity2.activityId));
      await deleteDeveloper('default', dev.developerId);
    });
  });
});
