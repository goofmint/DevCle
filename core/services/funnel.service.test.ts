/**
 * Funnel Service Tests
 *
 * Tests for funnel analysis business logic:
 * - classifyStage(): Activity stage classification
 * - getFunnelStats(): Funnel statistics calculation
 */

import { describe, it, expect, afterAll } from 'vitest';
import { setTenantContext, closeDb, getDb } from '../db/connection';
import * as schema from '../db/schema/index';
import { eq, and } from 'drizzle-orm';
import { classifyStage, getFunnelStats } from './funnel.service';
import { createActivity } from './activity.service';

/**
 * Test Setup
 *
 * - beforeAll: Set tenant context for all tests
 * - afterAll: Clean up and close database connection
 * - beforeEach: Clean up activities table before each test (fresh state)
 */
describe('Funnel Service', () => {
  // Use dedicated test tenant to avoid conflicts with seed data
  const TEST_TENANT = 'test-funnel-service';
  const OTHER_TEST_TENANT = 'test-funnel-service-other';

  // Clean up after all tests
  afterAll(async () => {
    await closeDb();
  });

  // Helper function to create test developers
  // Each test should call this and clean up the developers at the end
  async function createTestDevelopers() {
    const db = getDb();

    // Ensure test tenants exist
    await db.insert(schema.tenants).values({
      tenantId: TEST_TENANT,
      name: 'Test Funnel Service Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    await db.insert(schema.tenants).values({
      tenantId: OTHER_TEST_TENANT,
      name: 'Other Test Funnel Service Tenant',
      plan: 'OSS',
    }).onConflictDoNothing();

    await setTenantContext(TEST_TENANT);
    const [alice] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: TEST_TENANT,
      displayName: 'Alice Anderson',
      primaryEmail: 'alice@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    const [bob] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: TEST_TENANT,
      displayName: 'Bob Builder',
      primaryEmail: 'bob@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    await setTenantContext(OTHER_TEST_TENANT);
    const [charlie] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: OTHER_TEST_TENANT,
      displayName: 'Charlie Chaplin',
      primaryEmail: 'charlie@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    await setTenantContext(TEST_TENANT);

    if (!alice || !bob || !charlie) {
      throw new Error('Failed to create test developers');
    }

    // Create activity-funnel mappings for test tenant (copy from default tenant mappings)
    // This ensures classifyStage can properly map activities to funnel stages
    await db.insert(schema.activityFunnelMap).values([
      { tenantId: TEST_TENANT, action: 'click', stageKey: 'awareness' },
      { tenantId: TEST_TENANT, action: 'view', stageKey: 'awareness' },
      { tenantId: TEST_TENANT, action: 'attend', stageKey: 'engagement' },
      { tenantId: TEST_TENANT, action: 'comment', stageKey: 'engagement' },
      { tenantId: TEST_TENANT, action: 'signup', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'api_call', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'deploy', stageKey: 'adoption' },
      { tenantId: TEST_TENANT, action: 'post', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'talk', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'referral', stageKey: 'advocacy' },
      { tenantId: TEST_TENANT, action: 'contribute', stageKey: 'advocacy' },
    ]).onConflictDoNothing();

    return {
      alice: alice.developerId,
      bob: bob.developerId,
      charlie: charlie.developerId,
    };
  }

  // Helper function to clean up test developers and their data
  async function cleanupTestDevelopers(aliceId: string, bobId: string, charlieId: string) {
    const db = getDb();

    // Delete activities
    await setTenantContext(TEST_TENANT);
    await db.delete(schema.activities).where(eq(schema.activities.developerId, aliceId));
    await db.delete(schema.activities).where(eq(schema.activities.developerId, bobId));

    await setTenantContext(OTHER_TEST_TENANT);
    await db.delete(schema.activities).where(eq(schema.activities.developerId, charlieId));

    // Delete custom mappings if any
    await db.delete(schema.activityFunnelMap).where(
      and(
        eq(schema.activityFunnelMap.tenantId, OTHER_TEST_TENANT),
        eq(schema.activityFunnelMap.action, 'custom_action')
      )
    );

    // Delete developers
    await setTenantContext(TEST_TENANT);
    await db.delete(schema.developers).where(eq(schema.developers.developerId, aliceId));
    await db.delete(schema.developers).where(eq(schema.developers.developerId, bobId));

    await setTenantContext(OTHER_TEST_TENANT);
    await db.delete(schema.developers).where(eq(schema.developers.developerId, charlieId));

    await setTenantContext(TEST_TENANT);
  }

  /**
   * classifyStage() Tests
   *
   * Tests activity classification into funnel stages based on action mappings.
   */
  describe('classifyStage', () => {
    it('should classify activity based on action mapping', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Arrange: Create an activity with action = "click"
        // According to seed data, "click" maps to "awareness" stage
        const activity = await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });

        // Act: Classify the activity
        const classified = await classifyStage(TEST_TENANT, activity.activityId);

        // Assert: Should be classified as "awareness"
        expect(classified).not.toBeNull();
        expect(classified?.activityId).toBe(activity.activityId);
        expect(classified?.developerId).toBe(alice);
        expect(classified?.action).toBe('click');
        expect(classified?.source).toBe('web');
        expect(classified?.stageKey).toBe('awareness');
        expect(classified?.ts).toBeInstanceOf(Date);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should return null stage for unmapped action', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Arrange: Create an activity with an unmapped action
        // "unknown_action" is not in the activity_funnel_map table
        const activity = await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'unknown_action',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });

        // Act: Classify the activity
        const classified = await classifyStage(TEST_TENANT, activity.activityId);

        // Assert: Should return classified activity with null stage (unmapped)
        expect(classified).not.toBeNull();
        expect(classified?.activityId).toBe(activity.activityId);
        expect(classified?.action).toBe('unknown_action');
        expect(classified?.stageKey).toBeNull(); // No mapping exists
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should respect tenant-specific mappings', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Arrange: Create custom mapping for OTHER_TEST_TENANT
        // Must be in OTHER_TEST_TENANT context due to RLS
        await setTenantContext(OTHER_TEST_TENANT);
        const db = getDb();
        await db.insert(schema.activityFunnelMap).values({
          tenantId: OTHER_TEST_TENANT,
          action: 'custom_action',
          stageKey: 'advocacy', // Map custom_action to advocacy stage for OTHER_TEST_TENANT
        });

        // Create activity for OTHER_TEST_TENANT
        const activity = await createActivity(OTHER_TEST_TENANT, {
          developerId: charlie,
          action: 'custom_action',
          source: 'custom',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });

        // Act: Classify the activity for OTHER_TEST_TENANT
        const classified = await classifyStage(OTHER_TEST_TENANT, activity.activityId);

        // Reset context
        await setTenantContext(TEST_TENANT);

        // Assert: Should be classified according to OTHER_TEST_TENANT mapping
        expect(classified?.stageKey).toBe('advocacy');
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should return null for non-existent activity', async () => {
      // Act: Try to classify non-existent activity
      // Using a valid UUID v4 format that doesn't exist in the database
      const classified = await classifyStage(TEST_TENANT, '99999999-9999-4999-8999-999999999999');

      // Assert: Should return null (activity not found)
      expect(classified).toBeNull();
    });
  });

  /**
   * getFunnelStats() Tests
   *
   * Tests funnel statistics calculation across all stages.
   */
  describe('getFunnelStats', () => {
    it('should return statistics for all 4 stages', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities across different stages
        // Developer 1: click (awareness) + attend (engagement)
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });

        // Developer 2: click (awareness)
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Should return 4 stages (awareness, engagement, adoption, advocacy)
        expect(stats.stages).toHaveLength(4);
        expect(stats.stages[0]?.stageKey).toBe('awareness');
        expect(stats.stages[1]?.stageKey).toBe('engagement');
        expect(stats.stages[2]?.stageKey).toBe('adoption');
        expect(stats.stages[3]?.stageKey).toBe('advocacy');
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should count unique developers per stage', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Awareness stage should have 2 unique developers (Alice and Bob)
        const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
        expect(awarenessStage?.uniqueDevelopers).toBe(2);

        // Assert: Engagement stage should have 1 unique developer (Alice only)
        const engagementStage = stats.stages.find(s => s.stageKey === 'engagement');
        expect(engagementStage?.uniqueDevelopers).toBe(1);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should count total activities per stage', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Awareness stage should have 2 activities (2 clicks)
        const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
        expect(awarenessStage?.totalActivities).toBe(2);

        // Assert: Engagement stage should have 1 activity (1 attend)
        const engagementStage = stats.stages.find(s => s.stageKey === 'engagement');
        expect(engagementStage?.totalActivities).toBe(1);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should calculate total unique developers', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Should have 2 unique developers total (Alice and Bob)
        expect(stats.totalDevelopers).toBe(2);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should return zero counts for stages with no activities', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Adoption stage should have zero counts (no signup/api_call/deploy activities)
        const adoptionStage = stats.stages.find(s => s.stageKey === 'adoption');
        expect(adoptionStage?.uniqueDevelopers).toBe(0);
        expect(adoptionStage?.totalActivities).toBe(0);

        // Assert: Advocacy stage should have zero counts (no post/talk/referral activities)
        const advocacyStage = stats.stages.find(s => s.stageKey === 'advocacy');
        expect(advocacyStage?.uniqueDevelopers).toBe(0);
        expect(advocacyStage?.totalActivities).toBe(0);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should respect tenant isolation', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Create activities for default tenant
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T10:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: alice,
          action: 'attend',
          source: 'event',
          occurredAt: new Date('2025-10-10T11:00:00Z'),
          metadata: {},
        });
        await createActivity(TEST_TENANT, {
          developerId: bob,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T12:00:00Z'),
          metadata: {},
        });

        // Arrange: Create activity for different tenant
        await createActivity(OTHER_TEST_TENANT, {
          developerId: charlie,
          action: 'click',
          source: 'web',
          occurredAt: new Date('2025-10-10T13:00:00Z'),
          metadata: {},
        });

        // Act: Get statistics for 'default' tenant
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Should not include other-tenant activities
        // Total developers should still be 2 (Alice and Bob only)
        expect(stats.totalDevelopers).toBe(2);

        const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
        // Alice and Bob have click activities in default tenant
        expect(awarenessStage?.uniqueDevelopers).toBe(2);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });

    it('should return stages in correct order', async () => {
      // Create test developers
      const { alice, bob, charlie } = await createTestDevelopers();

      try {
        // Act: Get funnel statistics
        const stats = await getFunnelStats(TEST_TENANT);

        // Assert: Stages should be ordered by order_no (1, 2, 3, 4)
        expect(stats.stages[0]?.orderNo).toBe(1);
        expect(stats.stages[1]?.orderNo).toBe(2);
        expect(stats.stages[2]?.orderNo).toBe(3);
        expect(stats.stages[3]?.orderNo).toBe(4);
      } finally {
        // Clean up
        await cleanupTestDevelopers(alice, bob, charlie);
      }
    });
  });
});
