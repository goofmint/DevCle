/**
 * Funnel Service Tests
 *
 * Tests for funnel analysis business logic:
 * - classifyStage(): Activity stage classification
 * - getFunnelStats(): Funnel statistics calculation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setTenantContext, clearTenantContext, closeDb, getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { classifyStage, getFunnelStats } from './funnel.service.js';
import { createActivity } from './activity.service.js';

/**
 * Test Setup
 *
 * - beforeAll: Set tenant context for all tests
 * - afterAll: Clean up and close database connection
 * - beforeEach: Clean up activities table before each test (fresh state)
 */
describe('Funnel Service', () => {
  // Set tenant context before all tests
  beforeAll(async () => {
    await setTenantContext('default');
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearTenantContext();
    await closeDb();
  });

  // Developer IDs for testing (we'll create these in beforeEach)
  let aliceDeveloperId: string;
  let bobDeveloperId: string;
  let charlieDeveloperId: string;

  // Clean up and create test developers before each test
  // This ensures each test starts with a clean state
  beforeEach(async () => {
    const db = getDb();

    // Clean up for 'default' tenant (must be in correct tenant context due to RLS)
    await setTenantContext('default');
    await db.delete(schema.activities).where(
      eq(schema.activities.tenantId, 'default')
    );
    await db.delete(schema.developers).where(
      eq(schema.developers.tenantId, 'default')
    );

    // Clean up for 'other-tenant' tenant (must be in correct tenant context due to RLS)
    await setTenantContext('other-tenant');
    await db.delete(schema.activities).where(
      eq(schema.activities.tenantId, 'other-tenant')
    );
    // Delete custom mappings created by tests
    await db.delete(schema.activityFunnelMap).where(
      and(
        eq(schema.activityFunnelMap.tenantId, 'other-tenant'),
        eq(schema.activityFunnelMap.action, 'custom_action')
      )
    );
    await db.delete(schema.developers).where(
      eq(schema.developers.tenantId, 'other-tenant')
    );

    // Create test developers for 'default' tenant
    // Ensure we're in 'default' tenant context
    await setTenantContext('default');
    const [alice] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'default',
      displayName: 'Alice Anderson',
      primaryEmail: 'alice@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    const [bob] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'default',
      displayName: 'Bob Builder',
      primaryEmail: 'bob@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    // Create test developer for 'other-tenant'
    // Switch to other-tenant context to avoid RLS violation
    await setTenantContext('other-tenant');
    const [charlie] = await db.insert(schema.developers).values({
      developerId: crypto.randomUUID(),
      tenantId: 'other-tenant',
      displayName: 'Charlie Chaplin',
      primaryEmail: 'charlie@example.com',
      orgId: null,
      consentAnalytics: true,
      tags: [],
    }).returning();

    // Switch back to default tenant context
    await setTenantContext('default');

    if (!alice || !bob || !charlie) {
      throw new Error('Failed to create test developers');
    }

    aliceDeveloperId = alice.developerId;
    bobDeveloperId = bob.developerId;
    charlieDeveloperId = charlie.developerId;
  });

  /**
   * classifyStage() Tests
   *
   * Tests activity classification into funnel stages based on action mappings.
   */
  describe('classifyStage', () => {
    it('should classify activity based on action mapping', async () => {
      // Arrange: Create an activity with action = "click"
      // According to seed data, "click" maps to "awareness" stage
      const activity = await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });

      // Act: Classify the activity
      const classified = await classifyStage('default', activity.activityId);

      // Assert: Should be classified as "awareness"
      expect(classified).not.toBeNull();
      expect(classified?.activityId).toBe(activity.activityId);
      expect(classified?.developerId).toBe(aliceDeveloperId);
      expect(classified?.action).toBe('click');
      expect(classified?.source).toBe('web');
      expect(classified?.stageKey).toBe('awareness');
      expect(classified?.ts).toBeInstanceOf(Date);
    });

    it('should return null stage for unmapped action', async () => {
      // Arrange: Create an activity with an unmapped action
      // "unknown_action" is not in the activity_funnel_map table
      const activity = await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'unknown_action',
        source: 'web',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });

      // Act: Classify the activity
      const classified = await classifyStage('default', activity.activityId);

      // Assert: Should return classified activity with null stage (unmapped)
      expect(classified).not.toBeNull();
      expect(classified?.activityId).toBe(activity.activityId);
      expect(classified?.action).toBe('unknown_action');
      expect(classified?.stageKey).toBeNull(); // No mapping exists
    });

    it('should respect tenant-specific mappings', async () => {
      // Arrange: Create custom mapping for other-tenant
      // Must be in other-tenant context due to RLS
      await setTenantContext('other-tenant');
      const db = getDb();
      await db.insert(schema.activityFunnelMap).values({
        tenantId: 'other-tenant',
        action: 'custom_action',
        stageKey: 'advocacy', // Map custom_action to advocacy stage for other-tenant
      });

      // Create activity for other-tenant
      const activity = await createActivity('other-tenant', {
        developerId: charlieDeveloperId,
        action: 'custom_action',
        source: 'custom',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });

      // Act: Classify the activity for other-tenant
      const classified = await classifyStage('other-tenant', activity.activityId);

      // Reset context
      await setTenantContext('default');

      // Assert: Should be classified according to other-tenant mapping
      expect(classified?.stageKey).toBe('advocacy');
    });

    it('should return null for non-existent activity', async () => {
      // Act: Try to classify non-existent activity
      // Using a valid UUID v4 format that doesn't exist in the database
      const classified = await classifyStage('default', '99999999-9999-4999-8999-999999999999');

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
    // Create test data before each test in this suite
    beforeEach(async () => {
      // Create activities across different stages
      // Developer 1: click (awareness) + attend (engagement)
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T10:00:00Z'),
        metadata: {},
      });
      await createActivity('default', {
        developerId: aliceDeveloperId,
        action: 'attend',
        source: 'event',
        occurredAt: new Date('2025-10-10T11:00:00Z'),
        metadata: {},
      });

      // Developer 2: click (awareness)
      await createActivity('default', {
        developerId: bobDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T12:00:00Z'),
        metadata: {},
      });
    });

    it('should return statistics for all 4 stages', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Should return 4 stages (awareness, engagement, adoption, advocacy)
      expect(stats.stages).toHaveLength(4);
      expect(stats.stages[0]?.stageKey).toBe('awareness');
      expect(stats.stages[1]?.stageKey).toBe('engagement');
      expect(stats.stages[2]?.stageKey).toBe('adoption');
      expect(stats.stages[3]?.stageKey).toBe('advocacy');
    });

    it('should count unique developers per stage', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Awareness stage should have 2 unique developers (Alice and Bob)
      const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
      expect(awarenessStage?.uniqueDevelopers).toBe(2);

      // Assert: Engagement stage should have 1 unique developer (Alice only)
      const engagementStage = stats.stages.find(s => s.stageKey === 'engagement');
      expect(engagementStage?.uniqueDevelopers).toBe(1);
    });

    it('should count total activities per stage', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Awareness stage should have 2 activities (2 clicks)
      const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
      expect(awarenessStage?.totalActivities).toBe(2);

      // Assert: Engagement stage should have 1 activity (1 attend)
      const engagementStage = stats.stages.find(s => s.stageKey === 'engagement');
      expect(engagementStage?.totalActivities).toBe(1);
    });

    it('should calculate total unique developers', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Should have 2 unique developers total (Alice and Bob)
      expect(stats.totalDevelopers).toBe(2);
    });

    it('should return zero counts for stages with no activities', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Adoption stage should have zero counts (no signup/api_call/deploy activities)
      const adoptionStage = stats.stages.find(s => s.stageKey === 'adoption');
      expect(adoptionStage?.uniqueDevelopers).toBe(0);
      expect(adoptionStage?.totalActivities).toBe(0);

      // Assert: Advocacy stage should have zero counts (no post/talk/referral activities)
      const advocacyStage = stats.stages.find(s => s.stageKey === 'advocacy');
      expect(advocacyStage?.uniqueDevelopers).toBe(0);
      expect(advocacyStage?.totalActivities).toBe(0);
    });

    it('should respect tenant isolation', async () => {
      // Arrange: Create activity for different tenant
      await createActivity('other-tenant', {
        developerId: charlieDeveloperId,
        action: 'click',
        source: 'web',
        occurredAt: new Date('2025-10-10T13:00:00Z'),
        metadata: {},
      });

      // Act: Get statistics for 'default' tenant
      const stats = await getFunnelStats('default');

      // Assert: Should not include other-tenant activities
      // Total developers should still be 2 (Alice and Bob only)
      expect(stats.totalDevelopers).toBe(2);

      const awarenessStage = stats.stages.find(s => s.stageKey === 'awareness');
      // Alice and Bob have click activities in default tenant
      expect(awarenessStage?.uniqueDevelopers).toBe(2);
    });

    it('should return stages in correct order', async () => {
      // Act: Get funnel statistics
      const stats = await getFunnelStats('default');

      // Assert: Stages should be ordered by order_no (1, 2, 3, 4)
      expect(stats.stages[0]?.orderNo).toBe(1);
      expect(stats.stages[1]?.orderNo).toBe(2);
      expect(stats.stages[2]?.orderNo).toBe(3);
      expect(stats.stages[3]?.orderNo).toBe(4);
    });
  });
});
